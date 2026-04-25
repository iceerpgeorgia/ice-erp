const https = require('https');
const options = {
  hostname: 'ice-erp.vercel.app',
  path: '/api/jobs',
  method: 'GET',
  headers: { 'Cookie': '' }
};
const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Location:', res.headers.location || '(none)');
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      if (Array.isArray(json)) console.log('Array length:', json.length, json[0] ? 'first: ' + JSON.stringify(json[0]).slice(0,100) : '');
      else console.log('Response:', body.slice(0,300));
    } catch { console.log('Raw:', body.slice(0,300)); }
  });
});
req.on('error', e => console.error(e));
req.end();
