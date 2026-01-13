const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllParsingRules() {
    try {
        console.log('Checking current count...');
        const countBefore = await prisma.parsing_scheme_rules.count();
        console.log(`Current parsing_scheme_rules count: ${countBefore}`);
        
        if (countBefore > 0) {
            console.log('\nDeleting all parsing rules...');
            const result = await prisma.parsing_scheme_rules.deleteMany();
            console.log(`✅ Deleted ${result.count} rules`);
            
            const countAfter = await prisma.parsing_scheme_rules.count();
            console.log(`New count: ${countAfter}`);
        } else {
            console.log('No rules to delete.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

deleteAllParsingRules();
