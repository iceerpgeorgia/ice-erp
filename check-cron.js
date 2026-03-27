async function main() {
  const res = await fetch('https://ice-erp.vercel.app/api/cron/bog-import-last-3-days', {
    headers: { 'x-vercel-cron': '1' }
  });
  const d = await res.json();
  console.log('Period:', JSON.stringify(d.period));
  console.log('Processed:', d.processedAccounts, 'Failed:', d.failedAccounts);

  const empty = (d.successes || []).filter(s => s.noTransactions);
  const withData = (d.successes || []).filter(s => !s.noTransactions);

  console.log('Days with data:', withData.length);
  console.log('Empty days:', empty.length);

  const dates = new Set();
  withData.forEach(s => {
    const parts = s.path.split('/');
    dates.add(parts[4]); // date segment
  });
  console.log('Dates with data:', [...dates].sort());

  const edates = new Set();
  empty.forEach(s => {
    const parts = s.path.split('/');
    edates.add(parts[4]);
  });
  console.log('Empty dates:', [...edates].sort());

  console.log('Failures:', (d.failures || []).length);
  if (d.failures && d.failures.length > 0) {
    console.log('Failure sample:', d.failures[0].reason);
  }
}
main().catch(e => console.error(e));
