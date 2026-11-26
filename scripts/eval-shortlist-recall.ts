// Read-only measurement: for bindings people made themselves, would the matching procedure find the
// same inventory if the goods name were seen for the first time?
// Sample: N random unique legacy bindings (insider + goods name + inventory, made before the
// suggestion system) plus every unique 'manual' binding (a person chose another inventory than the
// suggestion, or there was none). Only bindings whose inventory is still active and has the item's
// dimension count; the rest are reported as not testable.
// For each binding: step 1 (exact name), step 3 (fuzzy; history is skipped because the name is
// treated as new), otherwise steps 4-5: is the person's inventory among the AI's candidates, and
// what does the model answer.
// Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/eval-shortlist-recall.ts [legacySample=300]
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import {
  loadLlmCandidates,
  pickInventoryWithLlm,
  type LlmCandidate,
  type LlmMatchItem,
  type LlmPick,
} from '@/lib/waybills/llm-inventory-match';

type Row = {
  id: bigint;
  insider_uuid: string;
  goods_name: string;
  goods_code: string | null;
  unit: string | null;
  dimension_uuid: string | null;
  supplier: string | null;
  inventory_uuid: string;
  inventory_name: string;
  testable: boolean;
  exact_name: boolean;
  fuzzy_uuid: string | null;
  person_similarity: number;
};

type Outcome =
  | 'exact name (step 1)'
  | 'fuzzy right (step 3)'
  | 'fuzzy wrong (step 3)'
  | 'AI exact right'
  | 'AI exact wrong'
  | 'AI closest right'
  | 'AI closest wrong'
  | 'AI no pick';

const PARALLEL = 4;

function sampleQuery(status: string, limit: string) {
  // One representative line (the latest) per unique binding; random but fixed order (md5).
  return `
    WITH pairs AS (
      SELECT DISTINCT ON (i.insider_uuid, waybill_norm_name(i.goods_name), i.inventory_uuid)
             i.id, i.insider_uuid, i.goods_name, i.goods_code, i.unit, i.dimension_uuid, i.inventory_uuid, i.rs_id
        FROM rs_waybills_in_items i
       WHERE i.inventory_match_status = '${status}' AND i.inventory_uuid IS NOT NULL AND i.goods_name IS NOT NULL
       ORDER BY i.insider_uuid, waybill_norm_name(i.goods_name), i.inventory_uuid, i.id DESC
    ),
    picked AS (SELECT * FROM pairs ORDER BY md5(id::text) ${limit})
    SELECT p.id, p.insider_uuid::text AS insider_uuid, p.goods_name, p.goods_code, p.unit,
           p.dimension_uuid::text AS dimension_uuid, w.counteragent_name AS supplier,
           p.inventory_uuid::text AS inventory_uuid, v.name AS inventory_name,
           (v.is_active AND p.dimension_uuid IS NOT NULL AND v.dimension_uuid = p.dimension_uuid) AS testable,
           (waybill_norm_name(v.name) = waybill_norm_name(p.goods_name)) AS exact_name,
           similarity(waybill_norm_name(v.name), waybill_norm_name(p.goods_name))::float8 AS person_similarity,
           (SELECT f.uuid::text FROM (
              SELECT x.uuid, x.s, lead(x.s) OVER (ORDER BY x.s DESC) AS s2, row_number() OVER (ORDER BY x.s DESC) AS rn
                FROM (SELECT c.uuid, similarity(waybill_norm_name(c.name), waybill_norm_name(p.goods_name)) AS s
                        FROM inventories c
                       WHERE c.insider_uuid = p.insider_uuid AND c.is_active AND c.dimension_uuid = p.dimension_uuid
                         AND waybill_norm_name(c.name) % waybill_norm_name(p.goods_name)
                         AND waybill_name_numbers(c.name) = waybill_name_numbers(p.goods_name)
                       ORDER BY s DESC LIMIT 2) x
            ) f WHERE f.rn = 1 AND f.s >= 0.6 AND f.s - coalesce(f.s2, 0) >= 0.1) AS fuzzy_uuid
      FROM picked p
      JOIN inventories v ON v.uuid = p.inventory_uuid
      LEFT JOIN rs_waybills_in_api w ON w.rs_id = p.rs_id`;
}

async function evaluate(client: Anthropic, rows: Row[]) {
  const results: Array<{
    row: Row;
    outcome: Outcome;
    inShortlist: boolean | null;
    shortlistSize: number;
    pick: LlmPick | null;
    candidates: LlmCandidate[];
  }> = [];
  const queue = [...rows];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      if (row.exact_name) {
        results.push({ row, outcome: 'exact name (step 1)', inShortlist: null, shortlistSize: 0, pick: null, candidates: [] });
        continue;
      }
      if (row.fuzzy_uuid) {
        results.push({
          row,
          outcome: row.fuzzy_uuid === row.inventory_uuid ? 'fuzzy right (step 3)' : 'fuzzy wrong (step 3)',
          inShortlist: null, shortlistSize: 0, pick: null, candidates: [],
        });
        continue;
      }
      const item: LlmMatchItem = {
        id: row.id, insiderUuid: row.insider_uuid, goodsName: row.goods_name, goodsCode: row.goods_code,
        unit: row.unit, dimensionUuid: row.dimension_uuid, supplier: row.supplier,
      };
      const candidates = await loadLlmCandidates(item, row.id, true);
      const inShortlist = candidates.some((c) => c.inventoryUuid === row.inventory_uuid);
      let pick: LlmPick | null = null;
      let outcome: Outcome = 'AI no pick';
      for (let attempt = 0; attempt < 3 && !pick; attempt += 1) {
        try {
          pick = await pickInventoryWithLlm(client, item, candidates);
        } catch (error) {
          if (attempt === 2) console.error('model error', row.id, (error as Error).message);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      if (pick?.step === 'llm') outcome = pick.inventoryUuid === row.inventory_uuid ? 'AI exact right' : 'AI exact wrong';
      else if (pick?.step === 'expanded') outcome = pick.inventoryUuid === row.inventory_uuid ? 'AI closest right' : 'AI closest wrong';
      results.push({ row, outcome, inShortlist, shortlistSize: candidates.length, pick, candidates });
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return results;
}

function summarise(label: string, all: Row[], results: Awaited<ReturnType<typeof evaluate>>) {
  const count = (outcome: Outcome) => results.filter((r) => r.outcome === outcome).length;
  const ai = results.filter((r) => r.inShortlist !== null);
  const inList = ai.filter((r) => r.inShortlist);
  const notInList = ai.filter((r) => !r.inShortlist);
  const pickOf = (r: (typeof results)[number]) =>
    r.candidates.find((c) => c.inventoryUuid === r.pick?.inventoryUuid)?.name ?? null;
  const example = (r: (typeof results)[number]) => ({
    goods: r.row.goods_name.slice(0, 80),
    person: r.row.inventory_name.slice(0, 80),
    similarity: Math.round(r.row.person_similarity * 100) / 100,
    ai: pickOf(r)?.slice(0, 80) ?? null,
    outcome: r.outcome,
    reason: r.pick?.reason?.slice(0, 160) ?? null,
  });
  const byOutcome = (list: typeof results) =>
    Object.fromEntries(
      (['AI exact right', 'AI exact wrong', 'AI closest right', 'AI closest wrong', 'AI no pick'] as Outcome[]).map((o) => [
        o,
        list.filter((r) => r.outcome === o).length,
      ])
    );
  return {
    label,
    sampled: all.length,
    notTestable: all.length - results.length,
    tested: results.length,
    step1ExactName: count('exact name (step 1)'),
    step3FuzzyRight: count('fuzzy right (step 3)'),
    step3FuzzyWrong: count('fuzzy wrong (step 3)'),
    reachedAiSteps: ai.length,
    personsInventoryInShortlist: inList.length,
    personsInventoryNotInShortlist: notInList.length,
    avgShortlistSize: ai.length ? Math.round((ai.reduce((s, r) => s + r.shortlistSize, 0) / ai.length) * 10) / 10 : 0,
    whenInShortlist: byOutcome(inList),
    whenNotInShortlist: byOutcome(notInList),
    personSimilarityWhenMissing: notInList.map((r) => Math.round(r.row.person_similarity * 100) / 100).sort((a, b) => a - b),
    examplesMissing: notInList.slice(0, 15).map(example),
    examplesInListButWrongOrNone: inList.filter((r) => r.outcome !== 'AI exact right' && r.outcome !== 'AI closest right').slice(0, 15).map(example),
    examplesAll: label === 'manual' ? results.map(example) : undefined,
  };
}

async function main() {
  const legacySample = Math.min(Math.max(Number(process.argv[2] || 300), 1), 1000);
  const client = new Anthropic();
  const legacy = await prisma.$queryRawUnsafe<Row[]>(sampleQuery('legacy', `LIMIT ${legacySample}`));
  const manual = await prisma.$queryRawUnsafe<Row[]>(sampleQuery('manual', ''));
  console.error(`sampled legacy ${legacy.length}, manual ${manual.length}`);
  const legacyResults = await evaluate(client, legacy.filter((r) => r.testable));
  console.error('legacy done');
  const manualResults = await evaluate(client, manual.filter((r) => r.testable));
  console.log(JSON.stringify([summarise('legacy', legacy, legacyResults), summarise('manual', manual, manualResults)], null, 1));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
