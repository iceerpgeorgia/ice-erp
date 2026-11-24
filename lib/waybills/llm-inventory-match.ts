import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { prisma, withRetry } from '@/lib/prisma';

// Step 4 of waybill item inventory matching. Items the insert trigger left at 'none' get
// candidate inventories from trigram search; Claude picks one or none. Suggest only:
// this never sets inventory_uuid. Each item is sent to the model at most once.
export const LLM_MATCH_MODEL = 'claude-haiku-5-5';
export const LLM_MIN_CONFIDENCE = 0.7;
export type LlmEffort = 'low' | 'medium' | 'high';
export const LLM_EFFORT: LlmEffort = 'low';
const INVENTORY_CANDIDATES = 10;
const HISTORY_CANDIDATES = 5;
const PARALLEL_REQUESTS = 4;

export type LlmCandidate = {
  inventoryUuid: string;
  // Inventory name alone (the label adds internal number, group and dimension).
  name: string;
  label: string;
  similarity: number;
  // Earlier goods line bound to this inventory, when the candidate came from history.
  boundGoodsName: string | null;
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
};

const PickSchema = z.object({
  candidate: z
    .number()
    .int()
    .describe('Number of the candidate that is the same product, or 0 when none of them is'),
  confidence: z.number().describe('Confidence from 0 to 1 that the chosen candidate is the same product'),
  reason: z.string().describe('One short sentence explaining the choice'),
});

const SYSTEM_PROMPT = `You match goods lines from Georgian supplier waybills (RS.ge) to a company's inventory list.
Names may be in Georgian, Russian or English, with different word order, brand prefixes, article codes, abbreviations and spacing.

Pick the candidate that is the same product:
- The same kind of item (a valve is not a pipe, a drill bit is not a drill, an elbow is not a coupling).
- Every size, dimension, diameter, thread, capacity and clothing size in the goods line must correspond to the candidate. Formatting may differ: "32/25" = "DN 32-25", 2'' = 2", "20x1/2" = "20*1/2", "M" = "M/1". A different number or size means a different product.
- A candidate without any size may match only when it is otherwise the same product and no other candidate has the matching size.
- Brand names, article codes and colours in the goods line may be missing from the inventory name; that alone is not a mismatch.

Candidates marked "previously bound" show a goods line that a person already assigned to that inventory. Use it as evidence only when that goods line describes the same product with the same sizes.

If no candidate is clearly the same product, answer 0. A wrong match is worse than no match.`;

// Atomic numbers in a name, normalised so "1.0" = "1" and "2,5" = "2.5". Slashes and dashes split tokens.
export function nameNumbers(value: string | null | undefined): Set<string> {
  const matches = String(value ?? '').match(/\d+(?:[.,]\d+)?/g) ?? [];
  return new Set(matches.map((token) => String(Number(token.replace(',', '.')))));
}

// A candidate conflicts when its name carries a number the goods line does not have (another size).
export function numbersConflict(goodsName: string, candidateName: string): boolean {
  const goods = nameNumbers(goodsName);
  for (const number of nameNumbers(candidateName)) {
    if (!goods.has(number)) return true;
  }
  return false;
}

const formatInventoryLabel = (row: {
  name: string;
  internal_number: string | null;
  group_name: string | null;
  dimension: string | null;
}) => [row.internal_number, row.group_name, row.dimension, row.name].filter(Boolean).join(' | ');

/**
 * Loads up to 15 candidate inventories for one goods line, best trigram similarity first.
 * excludeItemId leaves that row out of the history candidates (used by the accuracy test).
 */
export async function loadLlmCandidates(item: LlmMatchItem, excludeItemId?: bigint): Promise<LlmCandidate[]> {
  // Units must match: without a dimension nothing qualifies.
  if (!item.dimensionUuid) return [];
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
       merged AS (
         SELECT DISTINCT ON (uuid) uuid, s, bound_goods_name
           FROM (SELECT * FROM hist UNION ALL SELECT * FROM inv) u
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
      item.dimensionUuid
    )
  );

  // Drop candidates with a number the goods line lacks: another size is never the same product.
  return rows
    .filter((row) => !numbersConflict(item.goodsName, row.name))
    .map((row) => ({
      inventoryUuid: row.uuid,
      name: row.name,
      label: formatInventoryLabel(row),
      similarity: Number(row.similarity),
      boundGoodsName: row.bound_goods_name,
    }));
}

/** Asks Claude to pick the matching candidate. Returns null inventory when none qualifies. */
export async function pickInventoryWithLlm(
  client: Anthropic,
  item: LlmMatchItem,
  candidates: LlmCandidate[],
  effort: LlmEffort = LLM_EFFORT
): Promise<LlmPick> {
  if (candidates.length === 0) {
    return { inventoryUuid: null, confidence: 0, reason: 'No candidates' };
  }

  const candidateLines = candidates
    .map((candidate, index) => {
      const evidence = candidate.boundGoodsName
        ? ` (previously bound for goods line: "${candidate.boundGoodsName}")`
        : '';
      return `${index + 1}. ${candidate.label}${evidence}`;
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

  if (response.stop_reason === 'refusal') {
    return { inventoryUuid: null, confidence: 0, reason: 'Model declined' };
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    return { inventoryUuid: null, confidence: 0, reason: 'Unparseable answer' };
  }

  const index = parsed.candidate - 1;
  const confidence = Math.min(Math.max(parsed.confidence, 0), 1);
  if (index < 0 || index >= candidates.length) {
    return { inventoryUuid: null, confidence, reason: parsed.reason };
  }
  return { inventoryUuid: candidates[index].inventoryUuid, confidence, reason: parsed.reason };
}

export type LlmMatchRunResult = {
  processed: number;
  suggested: number;
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
  const result: LlmMatchRunResult = { processed: 0, suggested: 0, noMatch: 0, errors: 0, stoppedEarly: null };
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
      if (pick.inventoryUuid && pick.confidence >= LLM_MIN_CONFIDENCE) {
        await withRetry(() =>
          prisma.$executeRawUnsafe(
            `UPDATE rs_waybills_in_items
                SET suggested_inventory_uuid = $2::uuid,
                    inventory_match_method = 'llm',
                    inventory_match_score = $3,
                    inventory_match_status = 'suggested',
                    inventory_llm_checked_at = now()
              WHERE id = $1 AND inventory_match_status = 'none' AND inventory_uuid IS NULL`,
            item.id,
            pick.inventoryUuid,
            Math.round(pick.confidence * 10000) / 10000
          )
        );
        result.suggested += 1;
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
