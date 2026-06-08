const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

function parseSQLStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarQuoteTag = '';
  let inComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    const prevChar = sql[i - 1];
    
    // Handle line comments
    if (!inDollarQuote && char === '-' && nextChar === '-') {
      inComment = true;
      current += char;
      continue;
    }
    
    // End line comment
    if (inComment && char === '\n') {
      inComment = false;
      current += char;
      continue;
    }
    
    // Skip in comments
    if (inComment) {
      current += char;
      continue;
    }
    
    // Handle dollar quotes
    if (char === '$') {
      const dollarMatch = sql.substring(i).match(/^\$([a-zA-Z_]\w*)?\$/);
      if (dollarMatch) {
        const tag = dollarMatch[1] || '';
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarQuoteTag = tag;
        } else if (tag === dollarQuoteTag) {
          inDollarQuote = false;
          dollarQuoteTag = '';
        }
        current += dollarMatch[0];
        i += dollarMatch[0].length - 1;
        continue;
      }
    }
    
    // Handle statement terminator
    if (!inDollarQuote && char === ';') {
      current += char;
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Add remaining statement
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }
  
  return statements;
}

async function main() {
  const sql = fs.readFileSync('./prisma/migrations/20260608000000_add_handover_emissions/migration.sql', 'utf-8');
  
  try {
    const statements = parseSQLStatements(sql);
    console.log(`Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing...`);
      await prisma.$executeRawUnsafe(statement);
    }
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
