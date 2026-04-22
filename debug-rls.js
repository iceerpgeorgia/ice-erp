/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rls = await prisma.$queryRawUnsafe(`
      SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('payments_ledger','payments','counteragents','projects','bank_accounts','User')
        OR (n.nspname = 'public' AND c.relname LIKE 'GE%')
      ORDER BY c.relname
    `);
    console.log('RLS status:');
    rls.forEach(r => console.log(`  ${r.table.padEnd(45)} enabled=${r.rls_enabled} forced=${r.rls_forced}`));

    const policies = await prisma.$queryRawUnsafe(`
      SELECT schemaname, tablename, policyname, cmd, roles::text, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    console.log(`\nPolicies (${policies.length} total):`);
    policies.forEach(p => console.log(`  ${p.tablename}.${p.policyname} cmd=${p.cmd} roles=${p.roles} qual=${(p.qual||'').slice(0,140)}`));

    const who = await prisma.$queryRawUnsafe(`SELECT current_user AS cu, session_user AS su, current_setting('role', true) AS role`);
    console.log(`\nCurrent connection: ${JSON.stringify(who)}`);
  } catch(e) { console.error('ERR', e.message); } finally { await prisma.$disconnect(); }
})();
