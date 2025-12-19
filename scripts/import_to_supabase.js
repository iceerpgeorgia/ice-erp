require('dotenv').config({ path: '.env.local' });

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// Use REMOTE_DATABASE_URL for Supabase
const remoteUrl = process.env.REMOTE_DATABASE_URL;
if (!remoteUrl) {
  console.error('❌ REMOTE_DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Override DATABASE_URL before importing Prisma
process.env.DATABASE_URL = remoteUrl;

// Now load the import script
const importScript = fs.readFileSync(path.join(__dirname, 'import_projects.js'), 'utf8');

// Execute it with modified environment
eval(importScript);
