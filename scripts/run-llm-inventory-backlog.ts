// Runs step 4 (LLM) of waybill item inventory matching over the whole queue: items at 'none',
// unbound and not yet sent to the model. Same code path as the hourly cron. Suggest only.
// Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/run-llm-inventory-backlog.ts
import { prisma } from '@/lib/prisma';
import { runLlmInventoryMatch } from '@/lib/waybills/llm-inventory-match';

async function main() {
  const totals = { processed: 0, suggested: 0, noMatch: 0, errors: 0 };
  const started = Date.now();
  for (;;) {
    const result = await runLlmInventoryMatch({ limit: 500 });
    totals.processed += result.processed;
    totals.suggested += result.suggested;
    totals.noMatch += result.noMatch;
    totals.errors += result.errors;
    console.log(
      `processed ${totals.processed} (suggested ${totals.suggested}, no match ${totals.noMatch}, errors ${totals.errors}) after ${Math.round((Date.now() - started) / 1000)}s`
    );
    if (result.stoppedEarly) {
      console.log(`Stopped: ${result.stoppedEarly}`);
      break;
    }
    // Queue empty, or every call in the batch failed (rate limit / outage): stop and rerun later.
    if (result.processed === 0) break;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
