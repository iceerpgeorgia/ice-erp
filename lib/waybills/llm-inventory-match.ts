import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { prisma, withRetry } from '@/lib/prisma';

// Steps 4 and 5 of waybill item inventory matching, in one model call. Items the insert trigger left
// at 'none' get candidate inventories; Claude answers an exact pick (step 4, method 'llm': the same
// product, every stated size present) and, only when there is no exact pick, the closest pick
// (step 5, method 'expanded': the same kind of item in the nearest size or variant). The code enforces
// the order: an "exact" pick missing a size of the goods line is downgraded to step 5.
// Suggest only: this never sets inventory_uuid. Each item is sent to the model at most once.
export const LLM_MATCH_MODEL = 'claude-haiku-5-5';
export const LLM_MIN_CONFIDENCE = 0.7;
export const EXPANDED_MIN_CONFIDENCE = 0.7;
export type LlmEffort = 'low' | 'medium' | 'high';
export const LLM_EFFORT: LlmEffort = 'low';
const INVENTORY_CANDIDATES = 10;
const HISTORY_CANDIDATES = 5;
// Most similar inventories that carry every size of the goods line.
const SIZED_CANDIDATES = 10;
const PARALLEL_REQUESTS = 4;

export type LlmCandidate = {
  inventoryUuid: string;
  // Inventory name alone (the label adds internal number, group and dimension).
  name: string;
  label: string;
  similarity: number;
  // Earlier goods line bound to this inventory, when the candidate came from history.
  boundGoodsName: string | null;
  // False when the candidate has sizes but lacks one the goods line states (another size): it can
  // only be a step 5 (expanded) pick.
  sizesMatch: boolean;
};

export type LlmMatchItem = {
  id: bigint;
  insiderUuid: string;
  goodsName: string;
  goodsCode: string | null;
  unit: string | null;
  // The item's dimension (from the unit map). Only inventories with this dimension are candidates.
  dimensionUuid: string | null;
  supplier: string | null;
};

export type LlmPick = {
  inventoryUuid: string | null;
  confidence: number;
  reason: string;
  // Which step the pick belongs to; null when nothing reached its confidence threshold.
  step: 'llm' | 'expanded' | null;
  // Raw answers, for the accuracy test.
  exactUuid: string | null;
  exactConfidence: number;
  closestUuid: string | null;
  closestConfidence: number;
};

const PickSchema = z.object({
  exact: z
    .number()
    .int()
    .describe('Number of the candidate that is the same product, or 0 when none of them is'),
  exact_confidence: z.number().describe('Confidence from 0 to 1 that the exact candidate is the same product (0 when exact is 0)'),
  closest: z
    .number()
    .int()
    .describe('Only when exact is 0: number of the candidate that is the same kind of item in the nearest size or variant, or 0'),
  closest_confidence: z.number().describe('Confidence from 0 to 1 that the closest candidate is the same kind of item (0 when closest is 0)'),
  reason: z.string().describe('One short sentence explaining the choice'),
});

const SYSTEM_PROMPT = `You match goods lines from Georgian supplier waybills (RS.ge) to a company's inventory list.
Names may be in Georgian, Russian or English, with different word order, brand prefixes, article codes, abbreviations and spacing.

Pick the candidate that is the same product:
- The same kind of item (a valve is not a pipe, a drill bit is not a drill, an elbow is not a coupling).
- Every size, dimension, diameter, thread, capacity and clothing size in the goods line must correspond to the candidate. Formatting may differ: "32/25" = "DN 32-25", 2'' = 2", "20x1/2" = "20*1/2", "M" = "M/1", "16MM" = "16მმ". A different number or size means a different product.
- The candidate may state more than the goods line, for example a length the goods line leaves out ("drill bit 16MM" = "drill bit 16*150მმ"), as long as nothing in it contradicts the goods line. When several candidates fit, prefer the one whose type and material agree best (metal, wood, stone, SDS).
- A candidate without any size may match only when it is otherwise the same product and no other candidate has the matching size.
- Brand names, article codes and colours in the goods line may be missing from the inventory name; that alone is not a mismatch.

Candidates marked "previously bound" show a goods line that a person already assigned to that inventory. Use it as evidence only when that goods line describes the same product with the same sizes.

Candidates marked "other size" lack a size stated in the goods line; they can never be the exact answer.

Answer twice:
- exact: the candidate that is the same product, or 0. If no candidate is clearly the same product, answer 0. A wrong exact match is worse than none.
- closest: only when exact is 0, the candidate that is the same kind of item (same type and material, for example the same pliers, drill bit, tape measure or fitting) in the nearest size or variant. A person will review it as "closest size", so a different size is fine here, but a different kind of item is not: answer 0 when no candidate is the same kind of item. When exact is not 0, closest is 0.`;

// Atomic numbers in a name, normalised so "1.0" = "1" and "2,5" = "2.5". Slashes and dashes split tokens.
export function nameNumbers(value: string | null | undefined): Set<string> {
  const matches = String(value ?? '').match(/\d+(?:[.,]\d+)?/g) ?? [];
  return new Set(matches.map((token) => String(Number(token.replace(',', '.')))));
}

// Size numbers of a goods line. Left out because they are not sizes: article codes (a token starting
// with two or more Latin letters followed by a digit, such as "TOL648-75162", or holding a 5+ digit
// number) and percentages ("30%").
export function sizeNumbers(value: string | null | undefined): Set<string> {
  const withoutCodes = String(value ?? '')
    .split(/\s+/)
    .filter((token) => !/^[A-Za-z]{2,}\d/.test(token) && !/\d{5,}/.test(token))
    .join(' ')
    .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ');
  return nameNumbers(withoutCodes);
}

// A candidate conflicts when it has sizes but lacks one the goods line states (another size). It may
// carry extra numbers the goods line leaves out (a length, for example): "16MM" fits "16*150მმ".
// A candidate without any number never conflicts; the model decides whether it is the same product.
export function numbersConflict(goodsName: string, candidateName: string): boolean {
  const candidate = nameNumbers(candidateName);
  if (candidate.size === 0) return false;
  for (const number of sizeNumbers(goodsName)) {
    if (!candidate.has(number)) return true;
  }
  return false;
}

// Numbers of every active inventory per insider + dimension, loaded once per process run, so that
// candidates carrying the goods line's sizes can be found even when their wording differs.
const SIZE_INDEX_TTL_MS = 10 * 60 * 1000;
const sizeIndexCache = new Map<string, { loadedAt: number; rows: Array<{ uuid: string; numbers: Set<string> }> }>();

async function inventoriesWithSizes(insiderUuid: string, dimensionUuid: string, sizes: Set<string>): Promise<string[]> {
  const key = `${insiderUuid}|${dimensionUuid}`;
  let entry = sizeIndexCache.get(key);
  if (!entry || Date.now() - entry.loadedAt > SIZE_INDEX_TTL_MS) {
    const rows = await withRetry(() =>
      prisma.$queryRawUnsafe<Array<{ uuid: string; name: string }>>(
        `SELECT uuid::text AS uuid, name FROM inventories
          WHERE insider_uuid = $1::uuid AND dimension_uuid = $2::uuid AND is_active`,
        insiderUuid,
        dimensionUuid
      )
    );
    entry = { loadedAt: Date.now(), rows: rows.map((row) => ({ uuid: row.uuid, numbers: nameNumbers(row.name) })) };
    sizeIndexCache.set(key, entry);
  }
  return entry.rows
    .filter((row) => [...sizes].every((size) => row.numbers.has(size)))
    .map((row) => row.uuid);
}

const formatInventoryLabel = (row: {
  name: string;
  internal_number: string | null;
  group_name: string | null;
  dimension: string | null;
}) => [row.internal_number, row.group_name, row.dimension, row.name].filter(Boolean).join(' | ');

/**
 * Loads candidate inventories for one goods line: the best trigram matches, earlier bound goods lines,
 * and the most similar inventories that carry every size of the goods line (so a differently worded
 * inventory with the right size is not crowded out by other sizes of a similar name).
 * excludeItemId leaves that row out of the history candidates (used by the accuracy test).
 */
export async function loadLlmCandidates(item: LlmMatchItem, excludeItemId?: bigint): Promise<LlmCandidate[]> {
  // Units must match: without a dimension nothing qualifies.
  if (!item.dimensionUuid) return [];
  const sizes = sizeNumbers(item.goodsName);
  const sizedUuids = sizes.size > 0 ? await inventoriesWithSizes(item.insiderUuid, item.dimensionUuid, sizes) : [];
  const rows = await withRetry(() =>
    prisma.$queryRawUnsafe<
      Array<{
        uuid: string;
        similarity: number;
        bound_goods_name: string | null;
        name: string;
        internal_number: string | null;
        group_name: string | null;
        dimension: string | null;
      }>
    >(
      `WITH target AS (SELECT waybill_norm_name($1) AS n),
       inv AS (
         SELECT v.uuid, similarity(waybill_norm_name(v.name), t.n) AS s, NULL::text AS bound_goods_name
           FROM inventories v, target t
          WHERE v.insider_uuid = $2::uuid AND v.is_active AND v.dimension_uuid = $4::uuid
            AND waybill_norm_name(v.name) % t.n
          ORDER BY s DESC
          LIMIT ${INVENTORY_CANDIDATES}
       ),
       hist AS (
         SELECT * FROM (
           SELECT DISTINCT ON (h.inventory_uuid)
                  h.inventory_uuid AS uuid, similarity(waybill_norm_name(h.goods_name), t.n) AS s, h.goods_name AS bound_goods_name
             FROM rs_waybills_in_items h
             JOIN inventories hv ON hv.uuid = h.inventory_uuid AND hv.dimension_uuid = $4::uuid,
                  target t
            WHERE h.insider_uuid = $2::uuid AND h.inventory_uuid IS NOT NULL
              AND h.id <> $3
              AND waybill_norm_name(h.goods_name) % t.n
            ORDER BY h.inventory_uuid, s DESC
         ) x
         ORDER BY s DESC
         LIMIT ${HISTORY_CANDIDATES}
       ),
       sized AS (
         SELECT v.uuid, similarity(waybill_norm_name(v.name), t.n) AS s, NULL::text AS bound_goods_name
           FROM inventories v, target t
          WHERE v.uuid = ANY($5::uuid[])
          ORDER BY s DESC
          LIMIT ${SIZED_CANDIDATES}
       ),
       merged AS (
         SELECT DISTINCT ON (uuid) uuid, s, bound_goods_name
           FROM (SELECT * FROM hist UNION ALL SELECT * FROM inv UNION ALL SELECT * FROM sized) u
          ORDER BY uuid, (bound_goods_name IS NOT NULL) DESC, s DESC
       )
       SELECT m.uuid::text AS uuid, m.s::float8 AS similarity, m.bound_goods_name,
              v.name, v.internal_number, g.name AS group_name, d.dimension
         FROM merged m
         JOIN inventories v ON v.uuid = m.uuid
         LEFT JOIN inventory_groups g ON g.uuid = v.inventory_group_uuid
         LEFT JOIN dimensions d ON d.uuid = v.dimension_uuid
        ORDER BY m.s DESC`,
      item.goodsName,
      item.insiderUuid,
      excludeItemId ?? BigInt(-1),
      item.dimensionUuid,
      sizedUuids
    )
  );

  // Candidates missing a size the goods line states stay for step 5 but are flagged: another size is
  // never the same product. Same-size candidates come first.
  return rows
    .map((row) => ({
      inventoryUuid: row.uuid,
      name: row.name,
      label: formatInventoryLabel(row),
      similarity: Number(row.similarity),
      boundGoodsName: row.bound_goods_name,
      sizesMatch: !numbersConflict(item.goodsName, row.name),
    }))
    .sort((a, b) => Number(b.sizesMatch) - Number(a.sizesMatch) || b.similarity - a.similarity);
}

/** Asks Claude to pick the matching candidate. Returns null inventory when none qualifies. */
export async function pickInventoryWithLlm(
  client: Anthropic,
  item: LlmMatchItem,
  candidates: LlmCandidate[],
  effort: LlmEffort = LLM_EFFORT
): Promise<LlmPick> {
  const none = (reason: string): LlmPick => ({
    inventoryUuid: null, confidence: 0, reason, step: null,
    exactUuid: null, exactConfidence: 0, closestUuid: null, closestConfidence: 0,
  });
  if (candidates.length === 0) return none('No candidates');

  const candidateLines = candidates
    .map((candidate, index) => {
      const evidence = candidate.boundGoodsName
        ? ` (previously bound for goods line: "${candidate.boundGoodsName}")`
        : '';
      return `${index + 1}. ${candidate.label}${candidate.sizesMatch ? '' : ' (other size)'}${evidence}`;
    })
    .join('\n');

  const goodsLines = [
    `Goods name: ${item.goodsName}`,
    item.goodsCode ? `Goods code: ${item.goodsCode}` : null,
    item.unit ? `Unit: ${item.unit}` : null,
    item.supplier ? `Supplier: ${item.supplier}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.messages.parse({
    model: LLM_MATCH_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    output_config: { effort, format: zodOutputFormat(PickSchema) },
    messages: [
      {
        role: 'user',
        content: `${goodsLines}\n\nInventory candidates:\n${candidateLines}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') return none('Model declined');
  const parsed = response.parsed_output;
  if (!parsed) return none('Unparseable answer');

  const clamp = (value: number) => Math.min(Math.max(Number(value) || 0, 0), 1);
  const at = (number: number) => (number >= 1 && number <= candidates.length ? candidates[number - 1] : null);
  const exact = at(parsed.exact);
  const closest = at(parsed.closest);
  const exactConfidence = exact ? clamp(parsed.exact_confidence) : 0;
  const closestConfidence = closest ? clamp(parsed.closest_confidence) : 0;
  const result: LlmPick = {
    inventoryUuid: null, confidence: 0, reason: parsed.reason, step: null,
    exactUuid: exact?.inventoryUuid ?? null, exactConfidence,
    closestUuid: closest?.inventoryUuid ?? null, closestConfidence,
  };

  // Step 4: an exact pick counts only when it carries every size of the goods line.
  if (exact && exact.sizesMatch && exactConfidence >= LLM_MIN_CONFIDENCE) {
    return { ...result, inventoryUuid: exact.inventoryUuid, confidence: exactConfidence, step: 'llm' };
  }
  // Step 5: the closest pick, or an "exact" pick that turned out to be another size.
  const expanded = closest ?? (exact && !exact.sizesMatch ? exact : null);
  const expandedConfidence = closest ? closestConfidence : exactConfidence;
  if (expanded && expandedConfidence >= EXPANDED_MIN_CONFIDENCE) {
    return { ...result, inventoryUuid: expanded.inventoryUuid, confidence: expandedConfidence, step: 'expanded' };
  }
  return result;
}

export type LlmMatchRunResult = {
  processed: number;
  suggested: number;
  // Of the suggestions, how many are step 5 (closest size or variant).
  expanded: number;
  noMatch: number;
  errors: number;
  stoppedEarly: string | null;
};

/**
 * Processes queued items (status 'none', unbound, not yet sent to the model), newest first.
 * Database work runs one query at a time (single-connection pool); model calls run a few at a time.
 */
export async function runLlmInventoryMatch(options: { limit?: number } = {}): Promise<LlmMatchRunResult> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
  const result: LlmMatchRunResult = { processed: 0, suggested: 0, expanded: 0, noMatch: 0, errors: 0, stoppedEarly: null };
  if (!process.env.ANTHROPIC_API_KEY) {
    result.stoppedEarly = 'ANTHROPIC_API_KEY is not set';
    return result;
  }
  const client = new Anthropic();

  const queue = await withRetry(() =>
    prisma.$queryRawUnsafe<
      Array<{ id: bigint; insider_uuid: string; goods_name: string; goods_code: string | null; unit: string | null; dimension_uuid: string | null; supplier: string | null }>
    >(
      `SELECT i.id, i.insider_uuid::text AS insider_uuid, i.goods_name, i.goods_code, i.unit, i.dimension_uuid::text AS dimension_uuid,
              w.counteragent_name AS supplier
         FROM rs_waybills_in_items i
         LEFT JOIN rs_waybills_in_api w ON w.rs_id = i.rs_id
        WHERE i.inventory_match_status = 'none'
          AND i.inventory_uuid IS NULL
          AND i.inventory_llm_checked_at IS NULL
          AND i.goods_name IS NOT NULL
          AND i.dimension_uuid IS NOT NULL
        ORDER BY i.id DESC
        LIMIT $1`,
      limit
    )
  );

  for (let start = 0; start < queue.length; start += PARALLEL_REQUESTS) {
    const chunk = queue.slice(start, start + PARALLEL_REQUESTS).map((row) => ({
      id: row.id,
      insiderUuid: row.insider_uuid,
      goodsName: row.goods_name,
      goodsCode: row.goods_code,
      unit: row.unit,
      dimensionUuid: row.dimension_uuid,
      supplier: row.supplier,
    }));

    const withCandidates: Array<{ item: LlmMatchItem; candidates: LlmCandidate[] }> = [];
    for (const item of chunk) {
      withCandidates.push({ item, candidates: await loadLlmCandidates(item) });
    }

    const picks = await Promise.allSettled(
      withCandidates.map(({ item, candidates }) => pickInventoryWithLlm(client, item, candidates))
    );

    for (let k = 0; k < picks.length; k += 1) {
      const outcome = picks[k];
      const { item } = withCandidates[k];
      if (outcome.status === 'rejected') {
        const error = outcome.reason;
        // Bad key or no permission: every later call fails the same way.
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          result.stoppedEarly = `Claude API rejected the credentials: ${error.message}`;
          return result;
        }
        // Rate limit or server error after the SDK's own retries: leave the item queued.
        result.errors += 1;
        console.error('[llm-inventory-match] model call failed', { id: String(item.id), error });
        continue;
      }

      const pick = outcome.value;
      result.processed += 1;
      if (pick.inventoryUuid && pick.step) {
        const step = pick.step;
        await withRetry(() =>
          prisma.$executeRawUnsafe(
            `UPDATE rs_waybills_in_items
                SET suggested_inventory_uuid = $2::uuid,
                    inventory_match_method = $4,
                    inventory_match_score = $3,
                    inventory_match_status = 'suggested',
                    inventory_llm_checked_at = now()
              WHERE id = $1 AND inventory_match_status = 'none' AND inventory_uuid IS NULL`,
            item.id,
            pick.inventoryUuid,
            Math.round(pick.confidence * 10000) / 10000,
            step
          )
        );
        result.suggested += 1;
        if (step === 'expanded') result.expanded += 1;
      } else {
        await withRetry(() =>
          prisma.$executeRawUnsafe(
            `UPDATE rs_waybills_in_items SET inventory_llm_checked_at = now() WHERE id = $1`,
            item.id
          )
        );
        result.noMatch += 1;
      }
    }
  }

  return result;
}
