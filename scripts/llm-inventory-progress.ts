// Progress of step 4 (LLM) of waybill item inventory matching. Read-only.
// Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/llm-inventory-progress.ts
import { prisma } from '@/lib/prisma';

async function main() {
  const [row] = await prisma.$queryRawUnsafe<
    Array<{ checked: number; suggested: number; left: number; last_at: Date | null }>
  >(
    `SELECT count(*) FILTER (WHERE inventory_llm_checked_at IS NOT NULL)::int AS checked,
            count(*) FILTER (WHERE inventory_match_method = 'llm')::int AS suggested,
            count(*) FILTER (WHERE inventory_match_status = 'none' AND inventory_uuid IS NULL
                               AND inventory_llm_checked_at IS NULL)::int AS left,
            max(inventory_llm_checked_at) AS last_at
       FROM rs_waybills_in_items`
  );
  const total = row.checked + row.left;
  const percent = total ? Math.round((row.checked / total) * 1000) / 10 : 100;
  console.log(`Checked ${row.checked} of ${total} (${percent}%), suggested ${row.suggested}, left ${row.left}`);
  console.log(`Last item checked: ${row.last_at ? row.last_at.toISOString() : 'never'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
