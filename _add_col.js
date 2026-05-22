require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => client.query('ALTER TABLE financial_codes ADD COLUMN IF NOT EXISTS default_code_fc UUID')).then(() => { console.log('done'); client.end(); }).catch(e => { console.error(e.message); client.end(); process.exit(1); });
