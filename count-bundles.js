const {PrismaClient} = require("@prisma/client");
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT COUNT(*) as count FROM payments WHERE is_bundle_payment = true")
  .then(r => {
    console.log("Total bundle payments:", r[0].count.toString());
    return p.$disconnect();
  })
  .catch(e => { console.error(e.message); p.$disconnect(); });
