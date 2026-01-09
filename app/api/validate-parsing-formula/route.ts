import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { formula, availableColumns } = await request.json();

    if (!formula) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Formula is required' 
      });
    }

    const validation = validateFormula(formula, availableColumns || []);
    
    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error validating formula:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Failed to validate formula' 
    }, { status: 500 });
  }
}

function validateFormula(formula: string, availableColumns: string[]): {
  valid: boolean;
  error?: string;
  sqlPreview?: string;
} {
  try {
    // Remove leading = if present (Excel style)
    const cleanFormula = formula.trim().replace(/^=/, '');
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of cleanFormula) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { valid: false, error: 'Unmatched closing parenthesis' };
      }
    }
    if (parenCount > 0) {
      return { valid: false, error: 'Unmatched opening parenthesis' };
    }

    // Check for balanced quotes
    const doubleQuotes = (cleanFormula.match(/"/g) || []).length;
    const singleQuotes = (cleanFormula.match(/'/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
      return { valid: false, error: 'Unmatched double quotes' };
    }
    if (singleQuotes % 2 !== 0) {
      return { valid: false, error: 'Unmatched single quotes' };
    }

    // Supported functions
    const supportedFunctions = [
      'OR', 'AND', 'NOT',
      'SEARCH', 'EXACT', 
      'LEN', 'LEFT', 'RIGHT', 'UPPER', 'LOWER',
      'ISBLANK', 'ISEMPTY'
    ];

    // Extract all function names used
    const functionPattern = /([A-Z]+)\s*\(/gi;
    const functionsUsed = [...cleanFormula.matchAll(functionPattern)].map(m => m[1].toUpperCase());
    
    // Check for unsupported functions
    const unsupportedFunctions = functionsUsed.filter(fn => !supportedFunctions.includes(fn));
    if (unsupportedFunctions.length > 0) {
      return { 
        valid: false, 
        error: `Unsupported function(s): ${unsupportedFunctions.join(', ')}. Supported: ${supportedFunctions.join(', ')}` 
      };
    }

    // Extract column references (not inside quotes)
    const columnPattern = /\b([a-z_][a-z0-9_]*)\b/gi;
    let match;
    const possibleColumns = new Set<string>();
    
    // Remove string literals first
    const withoutStrings = cleanFormula.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
    
    const matches = [...withoutStrings.matchAll(columnPattern)];
    for (const m of matches) {
      const word = m[1].toUpperCase();
      // Skip if it's a supported function or SQL keyword
      if (!supportedFunctions.includes(word) && !['TRUE', 'FALSE', 'NULL'].includes(word)) {
        possibleColumns.add(m[1].toLowerCase());
      }
    }

    // Validate column references if availableColumns provided
    if (availableColumns.length > 0) {
      const invalidColumns = Array.from(possibleColumns).filter(
        col => !availableColumns.includes(col)
      );
      if (invalidColumns.length > 0) {
        return { 
          valid: false, 
          error: `Unknown column(s): ${invalidColumns.join(', ')}. Available: ${availableColumns.join(', ')}` 
        };
      }
    }

    // Generate SQL preview
    const sqlPreview = translateToSQL(cleanFormula);

    return { 
      valid: true, 
      sqlPreview 
    };
  } catch (error) {
    return { 
      valid: false, 
      error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

function translateToSQL(formula: string): string {
  let sql = formula;

  // Replace Excel functions with SQL equivalents
  sql = sql.replace(/SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/gi, 
    (_, searchText, column) => `${column} ILIKE '%${searchText}%'`);
  
  sql = sql.replace(/SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/gi, 
    (_, searchText, column) => `${column} ILIKE '%${searchText}%'`);

  sql = sql.replace(/EXACT\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/gi, 
    (_, exactText, column) => `${column} = '${exactText}'`);
  
  sql = sql.replace(/EXACT\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/gi, 
    (_, exactText, column) => `${column} = '${exactText}'`);

  sql = sql.replace(/ISBLANK\s*\(\s*(\w+)\s*\)/gi, 
    (_, column) => `${column} IS NULL`);
  
  sql = sql.replace(/ISEMPTY\s*\(\s*(\w+)\s*\)/gi, 
    (_, column) => `(${column} IS NULL OR ${column} = '')`);

  sql = sql.replace(/LEN\s*\(\s*(\w+)\s*\)/gi, 
    (_, column) => `LENGTH(${column})`);

  sql = sql.replace(/LEFT\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/gi, 
    (_, column, n) => `LEFT(${column}, ${n})`);

  sql = sql.replace(/RIGHT\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/gi, 
    (_, column, n) => `RIGHT(${column}, ${n})`);

  sql = sql.replace(/UPPER\s*\(\s*(\w+)\s*\)/gi, 
    (_, column) => `UPPER(${column})`);

  sql = sql.replace(/LOWER\s*\(\s*(\w+)\s*\)/gi, 
    (_, column) => `LOWER(${column})`);

  // Replace logical operators
  sql = sql.replace(/\bOR\b/gi, 'OR');
  sql = sql.replace(/\bAND\b/gi, 'AND');
  sql = sql.replace(/\bNOT\b/gi, 'NOT');

  return sql;
}
