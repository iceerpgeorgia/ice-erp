const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();

const server = http.createServer(async (req, res) => {
  if (req.url === '/test') {
    try {
      const count = await prisma.consolidatedBankAccount.count();
      const sample = await prisma.consolidatedBankAccount.findFirst({
        select: {
          uuid: true,
          transactionDate: true,
          correctionDate: true,
          exchangeRate: true
        }
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count,
        sample,
        columns: {
          correctionDate: sample?.correctionDate !== undefined ? 'exists' : 'missing',
          exchangeRate: sample?.exchangeRate !== undefined ? 'exists' : 'missing'
        }
      }, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        code: error.code
      }, null, 2));
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Test server running. Visit /test to check Prisma connection.');
  }
});

server.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
  console.log('Visit http://localhost:3001/test to test Prisma connection');
});
