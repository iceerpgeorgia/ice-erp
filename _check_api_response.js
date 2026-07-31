const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
const apiUrl = `http://localhost:3000/api/bank-transactions?project_uuid=${encodeURIComponent(projectUuid)}&limit=0`;

console.log(`Fetching from: ${apiUrl}`);

fetch(apiUrl, { 
  headers: {
    'Accept': 'application/json'
  }
})
  .then(res => {
    console.log(`Status: ${res.status}`);
    return res.json();
  })
  .then(data => {
    console.log('\n=== API RESPONSE ===');
    console.log(`Type: ${typeof data}, Is Array: ${Array.isArray(data)}`);
    console.log(`Length: ${data?.length || (data?.data?.length) || 'N/A'}`);
    
    const rows = Array.isArray(data) ? data : (data?.data || []);
    console.log(`\n=== TOTAL ROWS: ${rows.length} ===`);
    
    rows.forEach((row, idx) => {
      console.log(`\nRow ${idx}:`, {
        id: row.id,
        payment_id: row.payment_id,
        project_uuid: row.project_uuid,
        is_balance_record: row.is_balance_record,
        counteragent_uuid: row.counteragent_uuid,
        financial_code_uuid: row.financial_code_uuid,
      });
    });
    
    console.log(`\n=== FILTER ANALYSIS ===`);
    rows.forEach((row, idx) => {
      const passesProjectFilter = row.project_uuid === projectUuid;
      const passesBalanceFilter = !row.is_balance_record;
      const passesPaymentFilter = !!row.payment_id;
      
      console.log(`Row ${idx}: project✓=${passesProjectFilter}, notBalance✓=${passesBalanceFilter}, hasPayment✓=${passesPaymentFilter}`);
    });
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
