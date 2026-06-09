import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getProjectData() {
  const projectUuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2';

  // Get project with all relations
  const project = await prisma.projects.findUnique({
    where: { uuid: projectUuid },
    include: {
      insider: true,
      currency: true,
      financial_codes: {
        where: { is_active: true },
        take: 1,
      },
    },
  });

  if (!project) {
    console.error('Project not found:', projectUuid);
    await prisma.$disconnect();
    return;
  }

  console.log('=== PROJECT DATA ===');
  console.log('UUID:', project.uuid);
  console.log('Name:', project.name);
  console.log('Department:', project.department);
  console.log('Address:', project.address);
  console.log('Currency:', project.currency?.code);
  console.log('Insider ID:', project.insider_uuid);
  console.log('Insider:', project.insider?.name);
  console.log('');

  // Get insider details if exists
  if (project.insider_uuid) {
    const insider = await prisma.insiders.findUnique({
      where: { uuid: project.insider_uuid },
    });
    console.log('=== INSIDER DATA ===');
    console.log('UUID:', insider?.uuid);
    console.log('Name:', insider?.name);
    console.log('Entity Type:', insider?.entity_type);
    console.log('ID:', insider?.tin);
    console.log('Director:', insider?.director_name);
    console.log('Address Line 1:', insider?.address_line_1);
    console.log('Address Line 2:', insider?.address_line_2);
    console.log('');
  }

  // Get counteragents linked to this project (through payments, waybills, etc)
  const counteragentPayments = await prisma.payments.findMany({
    where: { project_uuid: projectUuid },
    distinct: ['counteragent_uuid'],
    include: {
      counteragent: true,
    },
    take: 5,
  });

  console.log('=== COUNTERAGENTS (from payments) ===');
  if (counteragentPayments.length > 0) {
    counteragentPayments.forEach((p, i) => {
      if (p.counteragent) {
        console.log(`\n[${i + 1}]`);
        console.log('UUID:', p.counteragent.uuid);
        console.log('Name:', p.counteragent.name);
        console.log('Entity Type:', p.counteragent.entity_type);
        console.log('TIN:', p.counteragent.tin);
        console.log('Director:', p.counteragent.director_name);
        console.log('Address 1:', p.counteragent.address_line_1);
        console.log('Address 2:', p.counteragent.address_line_2);
      }
    });
  } else {
    console.log('No counteragents found via payments');
  }

  // Get waybill counteragents
  const waybillCounters = await prisma.rs_waybills_in_api.findMany({
    where: { project_uuid: projectUuid },
    distinct: ['counteragent_uuid'],
    include: {
      counteragent: true,
    },
    take: 5,
  });

  if (waybillCounters.length > 0) {
    console.log('\n=== COUNTERAGENTS (from waybills) ===');
    waybillCounters.forEach((w, i) => {
      if (w.counteragent) {
        console.log(`\n[${i + 1}]`);
        console.log('UUID:', w.counteragent.uuid);
        console.log('Name:', w.counteragent.name);
        console.log('Entity Type:', w.counteragent.entity_type);
        console.log('TIN:', w.counteragent.tin);
        console.log('Director:', w.counteragent.director_name);
        console.log('Address 1:', w.counteragent.address_line_1);
        console.log('Address 2:', w.counteragent.address_line_2);
      }
    });
  }

  await prisma.$disconnect();
}

getProjectData().catch(console.error);
