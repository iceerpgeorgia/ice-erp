// Accuracy test for step 4 (LLM) of waybill item inventory matching. Read-only.
// Uses items people already bound that steps 1-3 would have missed: no exact inventory name
// and no other bound line with the same goods name. Each item is left out of its own
// history candidates, and the model's pick is compared with the person's choice.
// Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/eval-llm-inventory-match.ts [sampleSize]
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import {
  LLM_MATCH_MODEL,
  LLM_MIN_CONFIDENCE,
  loadLlmCandidates,
  pickInventoryWithLlm,
  type LlmEffort,
  type LlmMatchItem,
} from '@/lib/waybills/llm-inventory-match';

async function main() {
  const sampleSize = Math.min(Math.max(Number(process.argv[2] || 120), 1), 500);
  // Fixed sample (ordered by md5 of id) so runs with different settings score the same items.
  const effortArg = process.argv[3];
  const effort: LlmEffort = effortArg === 'medium' || effortArg === 'high' ? effortArg : 'low';
  const client = new Anthropic();

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: bigint; insider_uuid: string; goods_name: string; goods_code: string | null; unit: string | null; supplier: string | null; inventory_uuid: string }>
  >(
    `SELECT i.id, i.insider_uuid::text AS insider_uuid, i.goods_name, i.goods_code, i.unit,
            w.counteragent_name AS supplier, i.inventory_uuid::text AS inventory_uuid
       FROM rs_waybills_in_items i
       LEFT JOIN rs_waybills_in_api w ON w.rs_id = i.rs_id
      WHERE i.inventory_uuid IS NOT NULL AND i.goods_name IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM inventories v
                         WHERE v.insider_uuid = i.insider_uuid
                           AND waybill_norm_name(v.name) = waybill_norm_name(i.goods_name))
        AND NOT EXISTS (SELECT 1 FROM rs_waybills_in_items h
                         WHERE h.insider_uuid = i.insider_uuid AND h.inventory_uuid IS NOT NULL AND h.id <> i.id
                           AND waybill_norm_name(h.goods_name) = waybill_norm_name(i.goods_name))
      ORDER BY md5(i.id::text)
      LIMIT $1`,
    sampleSize
  );

  let correctInCandidates = 0;
  let suggested = 0;
  let suggestedCorrect = 0;
  let declined = 0;
  const wrong: string[] = [];
  // Every pick with an inventory, to compare agreement at other confidence thresholds.
  const picks: Array<{ confidence: number; correct: boolean }> = [];

  for (const row of rows) {
    const item: LlmMatchItem = {
      id: row.id,
      insiderUuid: row.insider_uuid,
      goodsName: row.goods_name,
      goodsCode: row.goods_code,
      unit: row.unit,
      supplier: row.supplier,
    };
    const candidates = await loadLlmCandidates(item, row.id);
    const correct = candidates.find((candidate) => candidate.inventoryUuid === row.inventory_uuid);
    if (correct) correctInCandidates += 1;

    const pick = await pickInventoryWithLlm(client, item, candidates, effort);
    if (pick.inventoryUuid) {
      picks.push({ confidence: pick.confidence, correct: pick.inventoryUuid === row.inventory_uuid });
    }
    if (pick.inventoryUuid && pick.confidence >= LLM_MIN_CONFIDENCE) {
      suggested += 1;
      if (pick.inventoryUuid === row.inventory_uuid) {
        suggestedCorrect += 1;
      } else if (wrong.length < 8) {
        const chosen = candidates.find((candidate) => candidate.inventoryUuid === pick.inventoryUuid);
        wrong.push(`"${row.goods_name.slice(0, 60)}" -> "${chosen?.label.slice(0, 60)}" (expected ${correct ? `"${correct.label.slice(0, 60)}"` : 'not among candidates'})`);
      }
    } else {
      declined += 1;
    }
  }

  console.log(JSON.stringify({
    model: LLM_MATCH_MODEL,
    effort,
    minConfidence: LLM_MIN_CONFIDENCE,
    sample: rows.length,
    correctInventoryAmongCandidates: correctInCandidates,
    suggested,
    suggestedCorrect,
    precision: suggested ? Math.round((suggestedCorrect / suggested) * 1000) / 10 : null,
    declinedOrLowConfidence: declined,
    byThreshold: [0.6, 0.7, 0.8, 0.9].map((threshold) => {
      const kept = picks.filter((pick) => pick.confidence >= threshold);
      const agree = kept.filter((pick) => pick.correct).length;
      return { threshold, suggested: kept.length, agree, agreementPct: kept.length ? Math.round((agree / kept.length) * 1000) / 10 : null };
    }),
    wrongExamples: wrong,
  }, null, 1));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
