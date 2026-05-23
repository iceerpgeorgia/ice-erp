require('dotenv').config({ path: '.env.local' });
const http = require('http');

const body = JSON.stringify({
  dateFrom: '2021-02-18T00:00:00',
  dateTo: '2021-02-18T23:59:59',
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/waybills/sync',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('Fetching 2021-02-18 from RS.ge API...');
const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});
req.on('error', e => console.error('Error:', e.message));
req.setTimeout(120000, () => { console.error('Timeout'); req.destroy(); });
req.write(body);
req.end();
