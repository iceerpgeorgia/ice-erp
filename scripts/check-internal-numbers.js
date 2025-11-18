// Check Internal Numbers Consistency
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInternalNumbers() {
  try {
    console.log('🔍 Checking Internal Numbers Consistency...\n');

    // Get all counteragents
    const counteragents = await prisma.counteragent.findMany({
      select: {
        id: true,
        internal_number: true,
        name: true
      },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Total counteragents: ${counteragents.length}\n`);

    // Check format: ICE + 6 digits
    const correctFormat = /^ICE\d{6}$/;
    let correctCount = 0;
    let incorrectCount = 0;
    let nullCount = 0;
    const issues = [];

    counteragents.forEach(c => {
      if (!c.internal_number) {
        nullCount++;
        issues.push({
          id: c.id,
          name: c.name,
          issue: 'NULL',
          current: null,
          expected: `ICE${String(c.id).padStart(6, '0')}`
        });
      } else if (!correctFormat.test(c.internal_number)) {
        incorrectCount++;
        issues.push({
          id: c.id,
          name: c.name,
          issue: 'Wrong format',
          current: c.internal_number,
          expected: `ICE${String(c.id).padStart(6, '0')}`
        });
      } else {
        // Check if number matches ID
        const expectedNumber = `ICE${String(c.id).padStart(6, '0')}`;
        if (c.internal_number === expectedNumber) {
          correctCount++;
        } else {
          incorrectCount++;
          issues.push({
            id: c.id,
            name: c.name,
            issue: 'Number mismatch',
            current: c.internal_number,
            expected: expectedNumber
          });
        }
      }
    });

    console.log('📈 Summary:');
    console.log(`   ✅ Correct format & matching ID: ${correctCount}`);
    console.log(`   ❌ Incorrect/mismatched: ${incorrectCount}`);
    console.log(`   ⚠️ NULL (not set): ${nullCount}`);

    if (issues.length > 0) {
      console.log(`\n❌ Found ${issues.length} issue(s):\n`);
      
      // Show first 10 issues
      issues.slice(0, 10).forEach((issue, index) => {
        console.log(`   ${index + 1}. ID ${issue.id} - ${issue.name || 'No name'}`);
        console.log(`      Issue: ${issue.issue}`);
        console.log(`      Current: ${issue.current || 'NULL'}`);
        console.log(`      Expected: ${issue.expected}`);
        console.log('');
      });

      if (issues.length > 10) {
        console.log(`   ... and ${issues.length - 10} more issues\n`);
      }

      console.log('💡 To fix, run: scripts/standardize-internal-numbers.sql');
    } else {
      console.log('\n✅ All internal numbers are correct!');
    }

    // Check for duplicates
    const duplicates = await prisma.$queryRaw`
      SELECT internal_number, COUNT(*) as count, ARRAY_AGG(id::text) as ids
      FROM counteragents
      WHERE internal_number IS NOT NULL
      GROUP BY internal_number
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(`\n⚠️ Found ${duplicates.length} duplicate internal number(s):`);
      duplicates.forEach(dup => {
        console.log(`   ${dup.internal_number}: Used by IDs ${dup.ids.join(', ')}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkInternalNumbers();
