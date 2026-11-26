// Read-only dry run: items still without any suggestion (status 'none', unbound) on waybills
// activated since a date are run through steps 4-5 again with the current code (one call per unique
// goods name + insider + dimension). Nothing is written. Shows how many would now get a suggestion.
// Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/eval-unsuggested-rerun.ts [since=2026-05-29]
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { loadLlmCandidates, pickInventoryWithLlm, sizeNumbers, type LlmMatchItem, type LlmPick } from '@/lib/waybills/llm-inventory-match';

const PARALLEL = 4;

type Row = {
  id: bigint;
  insider_uuid: string;
  goods_name: string;
  goods_code: string | null;
  unit: string | null;
  dimension_uuid: string | null;
  supplier: string | null;
  lines: number;
};

async function main() {
  const since = /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2] ?? '') ? process.argv[2] : '2026-05-29';
  const client = new Anthropic();
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT DISTINCT ON (i.insider_uuid, waybill_norm_name(i.goods_name), i.dimension_uuid)
            i.id, i.insider_uuid::text AS insider_uuid, i.goods_name, i.goods_code, i.unit,
            i.dimension_uuid::text AS dimension_uuid, w.counteragent_name AS supplier,
            (count(*) OVER (PARTITION BY i.insider_uuid, waybill_norm_name(i.goods_name), i.dimension_uuid))::int AS lines
       FROM rs_waybills_in_items i
       JOIN rs_waybills_in_api w ON w.rs_id = i.rs_id
      WHERE i.inventory_match_status = 'none' AND i.inventory_uuid IS NULL AND i.goods_name IS NOT NULL
        AND w.activation_time >= ($1::date)::timestamp AT TIME ZONE 'Asia/Tbilisi'
      ORDER BY i.insider_uuid, waybill_norm_name(i.goods_name), i.dimension_uuid, i.id DESC`,
    since
  );
  console.error(`unique goods names: ${rows.length}, lines: ${rows.reduce((s, r) => s + r.lines, 0)}`);

  const results: Array<{ row: Row; pick: LlmPick | null; candidates: number; chosen: string | null; error: boolean }> = [];
  const queue = [...rows];
  let done = 0;
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const item: LlmMatchItem = {
        id: row.id, insiderUuid: row.insider_uuid, goodsName: row.goods_name, goodsCode: row.goods_code,
        unit: row.unit, dimensionUuid: row.dimension_uuid, supplier: row.supplier,
      };
      let pick: LlmPick | null = null;
      let candidatesCount = 0;
      let chosen: string | null = null;
      let error = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const candidates = await loadLlmCandidates(item);
          candidatesCount = candidates.length;
          pick = await pickInventoryWithLlm(client, item, candidates);
          chosen = candidates.find((c) => c.inventoryUuid === pick?.inventoryUuid)?.name ?? null;
          error = false;
          break;
        } catch (e) {
          error = true;
          if (attempt === 2) console.error('error', row.id, (e as Error).message.slice(0, 120));
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      results.push({ row, pick, candidates: candidatesCount, chosen, error });
      done += 1;
      if (done % 100 === 0) console.error(`done ${done}/${rows.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const by = (step: 'llm' | 'expanded' | null) => results.filter((r) => !r.error && (r.pick?.step ?? null) === step);
  const lines = (list: typeof results) => list.reduce((s, r) => s + r.row.lines, 0);
  const sample = (list: typeof results, n: number) =>
    list
      .sort((a, b) => b.row.lines - a.row.lines)
      .slice(0, n)
      .map((r) => `${r.row.lines}x "${r.row.goods_name.slice(0, 70)}" -> "${(r.chosen ?? '').slice(0, 70)}" (${Math.round((r.pick?.confidence ?? 0) * 100)}%)`);
  const sizeRuleCases = results.filter((r) => r.pick?.step && /DIN|ISO|ГОСТ|GOST|^\s*\d+\.\d+\s*-|\(|კგ|kg|кг/i.test(r.row.goods_name));
  console.log(JSON.stringify({
    since,
    uniqueNames: rows.length,
    lines: lines(results),
    errors: results.filter((r) => r.error).length,
    noCandidates: results.filter((r) => !r.error && r.candidates === 0).length,
    step4Exact: { names: by('llm').length, lines: lines(by('llm')) },
    step5Closest: { names: by('expanded').length, lines: lines(by('expanded')) },
    stillNone: { names: by(null).length, lines: lines(by(null)) },
    namesWithCodesOrWeightsThatNowGetASuggestion: sizeRuleCases.length,
    examplesExact: sample(by('llm'), 25),
    examplesClosest: sample(by('expanded'), 15),
    examplesStillNone: by(null).sort((a, b) => b.row.lines - a.row.lines).slice(0, 15)
      .map((r) => `${r.row.lines}x "${r.row.goods_name.slice(0, 70)}" sizes=[${[...sizeNumbers(r.row.goods_name)].join(',')}] candidates=${r.candidates}: ${(r.pick?.reason ?? '').slice(0, 140)}`),
  }, null, 1));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
