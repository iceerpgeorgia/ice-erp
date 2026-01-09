import { compileFormulaToJS, evaluateCondition } from '../lib/formula-compiler';

// Test data - simulates a row from raw bank transaction table
const testRows = [
  {
    docsendername: 'გიორგი ნიქაბაძე',
    docinformation: 'Salary payment for December',
    docsrcamt: 2500,
    docsrcccy: 'GEL',
    docdstamt: 2500,
    docdstccy: 'GEL',
    docbranch: 'TBILISI',
    docno: 'PAY-001-2024',
    docvaluedate: '2024-12-01'
  },
  {
    docsendername: 'Company LLC',
    docinformation: 'Invoice payment #12345',
    docsrcamt: 500,
    docsrcccy: 'USD',
    docdstamt: 1825,
    docdstccy: 'GEL',
    docbranch: 'BATUMI',
    docno: 'INV-12345',
    docvaluedate: '2024-11-15'
  },
  {
    docsendername: 'ნიქა გელაშვილი',
    docinformation: 'Rent payment',
    docsrcamt: 1200,
    docsrcccy: 'GEL',
    docdstamt: 1200,
    docdstccy: 'GEL',
    docbranch: 'TBILISI',
    docno: null,
    docvaluedate: '2024-12-05'
  }
];

// Test formulas
const testFormulas = [
  {
    name: 'Georgian name search',
    formula: 'SEARCH("გიორგი", «docsendername»)',
    expectedMatches: [0]
  },
  {
    name: 'Salary OR Invoice',
    formula: 'OR(SEARCH("salary", «docinformation»), SEARCH("invoice", «docinformation»))',
    expectedMatches: [0, 1]
  },
  {
    name: 'GEL payments over 1000',
    formula: 'AND(«docsrcamt» > 1000, «docsrcccy» = "GEL")',
    expectedMatches: [0, 1]
  },
  {
    name: 'Tbilisi branch with document number',
    formula: 'AND(«docbranch» = "TBILISI", NOT(ISBLANK(«docno»)))',
    expectedMatches: [0]
  },
  {
    name: 'Same source and destination amount',
    formula: '«docsrcamt» = «docdstamt»',
    expectedMatches: [0, 2]
  }
];

console.log('🧪 Testing Formula Compiler\n');
console.log('='.repeat(80));

testFormulas.forEach(test => {
  console.log(`\n📝 Test: ${test.name}`);
  console.log(`Formula: ${test.formula}`);
  
  try {
    // Compile formula to JavaScript
    const compiledScript = compileFormulaToJS(test.formula);
    console.log(`Compiled: ${compiledScript}`);
    
    // Test against all rows
    const matches: number[] = [];
    testRows.forEach((row, index) => {
      const result = evaluateCondition(compiledScript, row);
      if (result) {
        matches.push(index);
      }
    });
    
    console.log(`\nMatched rows: ${matches.length > 0 ? matches.map(i => `#${i}`).join(', ') : 'None'}`);
    
    // Verify expected results
    const matchesCorrectly = 
      matches.length === test.expectedMatches.length &&
      matches.every((m, i) => m === test.expectedMatches[i]);
    
    if (matchesCorrectly) {
      console.log('✅ PASS - Matches expected results');
    } else {
      console.log(`❌ FAIL - Expected ${test.expectedMatches.join(', ')}, got ${matches.join(', ')}`);
    }
    
    // Show which rows matched
    matches.forEach(index => {
      const row = testRows[index];
      console.log(`   → Row #${index}: ${row.docsendername} - ${row.docinformation}`);
    });
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('✨ Tests complete!\n');
