const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Checking for triggers on counteragents table:\n");

    const triggers = await prisma.$queryRaw`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'counteragents'
      ORDER BY trigger_name
    `;

    if (triggers.length === 0) {
      console.log("No triggers found on counteragents table.");
    } else {
      console.log(`Found ${triggers.length} trigger(s):\n`);
      for (const t of triggers) {
        console.log(`Trigger: ${t.trigger_name}`);
        console.log(`Event: ${t.event_manipulation} on ${t.event_object_table}`);
        console.log(`Action: ${t.action_statement}`);
        console.log("");
      }
    }

    console.log("\nChecking column constraints on entity_type:\n");
    const constraints = await prisma.$queryRaw`
      SELECT 
        con.conname,
        con.contype,
        pg_get_constraintdef(con.oid)
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'counteragents'
    `;

    for (const c of constraints) {
      if (c.conname && c.conname.includes("entity")) {
        console.log(`Constraint: ${c.conname}`);
        console.log(`Type: ${c.contype}`);
        console.log(`Definition: ${c.pg_get_constraintdef}`);
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
})();
