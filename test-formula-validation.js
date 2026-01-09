// Test formula validation with multiple columns
const testFormulas = [
  {
    name: "Single column search",
    formula: 'SEARCH("გიორგი", docsendername)',
    columns: ['docsendername', 'docsrcamt', 'docsrcccy']
  },
  {
    name: "Two columns with AND",
    formula: 'AND(docsrcamt > 1000, docsrcccy = "GEL")',
    columns: ['docsendername', 'docsrcamt', 'docsrcccy']
  },
  {
    name: "Three columns with nested OR/AND",
    formula: 'AND(OR(SEARCH("salary", docinformation), SEARCH("ხელფასი", docsendername)), docsrcamt > 500)',
    columns: ['docsendername', 'docinformation', 'docsrcamt', 'docsrcccy']
  },
  {
    name: "Five columns complex",
    formula: 'AND(OR(SEARCH("invoice", docinformation), EXACT("PAY", docno)), docsrcamt > 100, docsrcccy = "GEL", docbranch = "TBILISI", NOT(ISBLANK(docsendername)))',
    columns: ['docsendername', 'docinformation', 'docno', 'docsrcamt', 'docsrcccy', 'docbranch']
  },
  {
    name: "Column comparison",
    formula: 'docsrcamt = docdstamt',
    columns: ['docsrcamt', 'docdstamt']
  },
  {
    name: "Invalid column (should fail)",
    formula: 'SEARCH("test", nonexistent_column)',
    columns: ['docsendername', 'docsrcamt']
  }
];

async function testFormulaValidation() {
  console.log('Testing Formula Validation API\n');
  console.log('='.repeat(80));

  for (const test of testFormulas) {
    console.log(`\n📝 ${test.name}`);
    console.log(`Formula: ${test.formula}`);
    console.log(`Available columns: ${test.columns.join(', ')}`);
    
    try {
      const response = await fetch('http://localhost:3001/api/validate-parsing-formula', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Note: In real usage, this would need authentication
        },
        body: JSON.stringify({ 
          formula: test.formula, 
          availableColumns: test.columns 
        }),
      });

      const result = await response.json();
      
      if (result.valid) {
        console.log('✅ Valid');
        console.log(`   SQL Preview: ${result.sqlPreview}`);
      } else {
        console.log('❌ Invalid');
        console.log(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`⚠️  Request failed: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✨ Test complete!\n');
}

testFormulaValidation();
