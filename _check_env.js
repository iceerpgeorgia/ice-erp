#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

console.log('DATABASE_URL from env:', process.env.DATABASE_URL ? '✓ SET' : '✗ NOT SET');
console.log('DATABASE_URL value (masked):', process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace(/:[^@]+@/, ':***@') 
  : 'NOT SET'
);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('First 30 chars:', process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET');
