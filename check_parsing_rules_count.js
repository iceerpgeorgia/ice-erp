const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkParsingRules() {
    try {
        const count = await prisma.parsing_scheme_rules.count();
        console.log('LOCAL parsing_scheme_rules count:', count);
        
        const rules = await prisma.parsing_scheme_rules.findMany({
            take: 5,
            select: {
                id: true,
                column_name: true,
                condition: true,
                counteragent_uuid: true
            }
        });
        
        console.log('\nFirst 5 rules:');
        rules.forEach(rule => {
            console.log(`  - ID: ${rule.id}, Column: ${rule.column_name}, Condition: ${rule.condition}`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkParsingRules();
