const https = require('https');

const url = 'https://ice-nk3qrs1nk-iceerp.vercel.app/api/projects/bundle-distribution?projectUuid=f67cc96b-365f-4a30-9819-a3ee7ad41b1f';

console.log('Testing production API endpoint:');
console.log(url);
console.log();

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
