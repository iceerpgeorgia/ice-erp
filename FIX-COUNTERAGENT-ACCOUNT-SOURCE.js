/**
 * FIX SUMMARY: Counteragent Account Number Source Issue
 * 
 * PROBLEM:
 * - The processing script was using docsenderacctno/docbenefacctno fields
 * - The doccoracct field (correspondent account from bank statement) was being ignored
 * - This caused mismatches where the UI showed different account numbers than in raw data
 * 
 * ROOT CAUSE:
 * In scripts/process-bog-gel-counteragents-first.js, lines 95-130:
 * - Only docsenderacctno (incoming) and docbenefacctno (outgoing) were used
 * - doccoracct field was never referenced
 * 
 * SOLUTION IMPLEMENTED:
 * Updated the processing logic to:
 * 1. PRIORITY 1: Use doccoracct if available (this is the actual counterparty account from statement)
 * 2. FALLBACK: Use docsenderacctno/docbenefacctno only if doccoracct is empty
 * 
 * NEW LOGIC (lines 104-138):
 * ```javascript
 * // PRIORITY 1: Use doccoracct if available
 * if (record.doccoracct && record.doccoracct.trim()) {
 *   counteragentAccountNumber = record.doccoracct.trim();
 * }
 * 
 * if (incoming payment) {
 *   // Get INN from sender
 *   // FALLBACK: Use docsenderacctno only if doccoracct not available
 *   if (!counteragentAccountNumber && record.docsenderacctno) {
 *     counteragentAccountNumber = record.docsenderacctno.trim();
 *   }
 * } else {
 *   // Get INN from beneficiary
 *   // FALLBACK: Use docbenefacctno only if doccoracct not available
 *   if (!counteragentAccountNumber && record.docbenefacctno) {
 *     counteragentAccountNumber = record.docbenefacctno.trim();
 *   }
 * }
 * ```
 * 
 * NEXT STEPS TO FIX EXISTING DATA:
 * 1. Run: node scripts/process-bog-gel-counteragents-first.js
 *    This will reprocess all records with the corrected logic
 * 
 * 2. The consolidated_bank_accounts table will be truncated and rebuilt
 * 
 * 3. All records will now have counteragent_account_number from doccoracct (primary)
 *    or docsenderacctno/docbenefacctno (fallback)
 * 
 * EXAMPLE:
 * Before: Record showing GE82TB7121745061100015 (from docsenderacctno)
 * After:  Same record showing GE87BG0000000609365272GEL (from doccoracct)
 */

console.log('Fix has been applied to: scripts/process-bog-gel-counteragents-first.js');
console.log('\nTo apply the fix to existing data, run:');
console.log('  node scripts/process-bog-gel-counteragents-first.js');
console.log('\nThis will reprocess all bank statement records with the corrected account number logic.');
