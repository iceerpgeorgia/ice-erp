import subprocess
import json

result = subprocess.run(
    ["node", "-e", r"""
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const jobs = await prisma.jobs.findMany({
    where: { job_name: { in: ["L0001", "L0002", "L0003", "L0004", "L0005"] } },
    select: { job_name, factory_no, is_active }
  });
  console.log(JSON.stringify(jobs, null, 2));
  await prisma.$disconnect();
})();
    """],
    capture_output=True,
    text=True
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr)
