const https = require('https');
const http = require('http');

async function testPaymentsReportAPI() {
  const url = 'http://localhost:3000/api/payments-report';
  
  console.log(`Testing API: ${url}\n`);
  
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log(`Total records returned: ${result.length}`);
          
          // Find payments with only bank transactions (accrual=0, order=0, payment!=0)
          const onlyBankPayments = result.filter(p => 
            p.accrual === 0 && p.order === 0 && p.payment !== 0
          );
          
          console.log(`\nPayments with only bank transactions (accrual=0, order=0, payment!=0): ${onlyBankPayments.length}`);
          
          console.log('\nExamples:');
          onlyBankPayments.slice(0, 5).forEach(p => {
            console.log(`  ${p.paymentId}: Payment=${p.payment}, Balance=${p.balance}, Latest=${p.latestDate}`);
          });
          
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      console.error('Error:', err.message);
      reject(err);
    });
  });
}

testPaymentsReportAPI().catch(console.error);
