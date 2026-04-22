/**
 * One-time backfill: assign counteragent_uuid to the 4 unassigned bank
 * transactions discovered by audit-unassigned-counteragents.js by invoking
 * the same reparseByCounteragentInn function used by counteragent POST/PATCH.
 *
 * INNs:
 *   415103989  -> ხათისხი 2018 - შპს   (3 rows in GE78BG..._BOG_GEL)
 *   445384753  -> აქთივ ბათუმი - შპს    (1 row in GE65TB..._TBC_GEL)
 */
import 'dotenv/config';
import { reparseByCounteragentInn } from './lib/bank-import/reparse';

(async () => {
  const inns = ['415103989', '445384753'];
  console.log(`[backfill] Reparsing INNs: ${inns.join(', ')}`);
  const summary = await reparseByCounteragentInn(inns);
  console.log('[backfill] Done:', JSON.stringify(summary, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error('[backfill] FAILED:', err);
  process.exit(1);
});
