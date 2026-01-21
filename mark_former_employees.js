// Update counteragents to mark them as former employees (was_emploee=true) in Supabase
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FORMER_EMPLOYEE_UUIDS = [
  'a4e9edc7-b81f-4483-9069-a7790aebe4fa',
  'b2931e48-3277-49c0-b41b-d5f9c4ca15ee',
  '450fd54a-fb2d-4593-9f15-1e59e4d2aef1',
  '37626c3c-eb8e-4891-bb91-ddfe7f70759f',
  '1e6628e8-f589-4eea-9c86-d73343c26d4c',
  '1b04f15a-e774-4756-adaf-94c4c0d1a6c5',
  '1ae99065-3a99-4a7e-aa63-fa21cf93a264',
  '83f0c711-34f6-45b3-a1ed-f85548418822',
  '2ff3a4bd-5868-4142-bdf6-bc3816dfd386',
  '482fcfeb-e52f-4ec0-98a2-148a6528ffc5',
  'c2e5d1a8-c855-41fc-a628-39633a3079fb',
  'adf7cfca-160d-48ee-8cac-74bf25cf103f',
  '19b57f57-d0a7-4926-a19d-43fa6bafefb0',
  'b2eb8aff-e66a-40e8-b5b8-dbf41ffe0a05',
  '026e84af-5543-4ea9-80af-407fc0e41968',
  '19bc5684-130f-4a77-a1aa-c0b8b72e02cd',
  'ab051763-5d42-467f-8549-04137afde270',
  'b8ab484e-3d49-4f54-9d90-4a309e685387',
  'a47dc082-9e78-49d2-9a31-0a1041c0452d',
  'e5dd6cc9-26cb-4eed-a1c5-0c74c521b935',
  'ccbdd9fe-e9fb-48b2-931b-de6e4f74b5f9',
  '8574a4ca-6bff-4b2f-9658-08edd306a0b3',
  'c2ee6a7d-7345-499b-81d4-d49654bb5af6',
  '59649006-cc6e-4c09-a5d1-26b519bd696f',
  'e3da5bd5-daad-4c23-8631-faef1c6ee29a',
  'fd984f05-842a-4ab5-bd4b-70a8ef46a054',
  'a0861db8-76ad-49ee-bd0d-ed854cb84d2a',
  '052d7898-0a49-4c50-9a3a-434a941bc149',
  'f79b82aa-279c-4335-ab38-308105bb82c5',
  '6223fa09-3123-44a6-8851-56744b4e0fa4',
  'c16820cb-b0fb-42f4-837e-8657b575f62a',
  'd93aa8af-4a63-4f10-82a7-021602f8c7f4',
  '9f17e6d3-c55d-483f-a693-eccadf466378',
  '51b08fa4-d631-42b3-96bc-bde5e210c68f',
  'e0298429-d69b-4461-af75-4198ee21ad3b',
  '6817dc00-6e5a-436f-9d46-a5acdfc3f89a',
  'ad724f19-7178-48c7-b51d-d23ced9010d7',
  'aaebd43f-36be-4b3f-98c5-ad7949093c7e',
  'fd6b1f65-d688-43b2-91e3-ba220d4ec049',
  'f148a76b-2acc-4272-b974-43a8bc73b705',
  '0fbeff6b-8913-46a0-a2c1-840682636b38',
  'bcc818c5-a4bb-4b92-a74e-bd874492c42f',
  'e5c73557-ef37-43d3-ba47-2c858c33b144',
  '1202a693-b76e-40ae-96a8-f44614218b22',
  '7a213940-ffb7-4653-a1cd-29e924f93fb0',
  '418224d4-928c-4f5b-8eed-27c327fb567b',
  'a9ddb18e-5c2d-4d01-9f46-bbd15eba5215',
  '812f4fcb-2646-4933-a6c9-3968d4a34994',
  '264c48e0-e388-4151-b133-52c119f32280',
  '7e65f577-9410-4b0a-9eef-aac0c6eabff9',
  '1a055bdf-a999-4282-93e5-d40169179bca',
  '5d900da3-2b2e-4271-a6e4-c87c4c42c2ad',
  'ba797b0d-84dd-42e8-b7af-e867741dcb94',
  '3358a72f-6bfc-407f-986c-20172e27d8b1',
  '854dd62e-6b39-44c8-8255-9464f609a9aa',
  '31032db4-00b1-42a8-a69a-a11b5ae69808',
  'bfbbcb04-a60c-4506-ad60-9872b0aed448'
];

async function markAsFormerEmployees() {
  console.log('\n========================================');
  console.log('  MARK AS FORMER EMPLOYEES (was_emploee)');
  console.log('========================================\n');
  console.log(`Processing ${FORMER_EMPLOYEE_UUIDS.length} counteragents...\n`);

  try {
    // First, verify these records exist
    const existing = await prisma.counteragents.findMany({
      where: {
        counteragent_uuid: {
          in: FORMER_EMPLOYEE_UUIDS
        }
      },
      select: {
        id: true,
        counteragent_uuid: true,
        name: true,
        counteragent: true,
        is_emploee: true,
        was_emploee: true
      }
    });

    console.log(`Found: ${existing.length} / ${FORMER_EMPLOYEE_UUIDS.length} in database\n`);

    if (existing.length < FORMER_EMPLOYEE_UUIDS.length) {
      const found = existing.map(e => e.counteragent_uuid);
      const missing = FORMER_EMPLOYEE_UUIDS.filter(uuid => !found.includes(uuid));
      console.log(`⚠ Warning: ${missing.length} UUIDs not found:`);
      missing.forEach(uuid => console.log(`  - ${uuid}`));
      console.log('');
    }

    // Show current status before update
    const alreadyMarked = existing.filter(e => e.was_emploee === true);
    const needsUpdate = existing.filter(e => e.was_emploee !== true);

    console.log('Current status:');
    console.log(`  Already marked as was_emploee: ${alreadyMarked.length}`);
    console.log(`  Need to update: ${needsUpdate.length}\n`);

    if (needsUpdate.length > 0) {
      // Update all counteragents with these UUIDs to was_emploee = true
      const result = await prisma.counteragents.updateMany({
        where: {
          counteragent_uuid: {
            in: FORMER_EMPLOYEE_UUIDS
          }
        },
        data: {
          was_emploee: true,
          updated_at: new Date()
        }
      });

      console.log(`✓ Successfully updated ${result.count} counteragents\n`);
    } else {
      console.log('✓ All records already marked as was_emploee=true\n');
    }

    // Verify the update
    console.log('Verifying updates...\n');

    const updated = await prisma.counteragents.findMany({
      where: {
        counteragent_uuid: {
          in: FORMER_EMPLOYEE_UUIDS
        },
        was_emploee: true
      },
      select: {
        id: true,
        counteragent_uuid: true,
        name: true,
        counteragent: true,
        is_emploee: true,
        was_emploee: true
      }
    });

    const notUpdated = await prisma.counteragents.findMany({
      where: {
        counteragent_uuid: {
          in: FORMER_EMPLOYEE_UUIDS
        },
        was_emploee: {
          not: true
        }
      },
      select: {
        id: true,
        counteragent_uuid: true,
        name: true,
        counteragent: true,
        is_emploee: true,
        was_emploee: true
      }
    });

    console.log('========================================');
    console.log('           VERIFICATION RESULTS');
    console.log('========================================\n');
    console.log(`✓ Correctly marked as was_emploee: ${updated.length}`);
    console.log(`✗ Still not marked: ${notUpdated.length}\n`);

    if (notUpdated.length > 0) {
      console.log('NOT UPDATED (still was_emploee ≠ true):');
      notUpdated.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.counteragent || c.name || 'N/A'}`);
        console.log(`   UUID: ${c.counteragent_uuid}`);
        console.log(`   was_emploee: ${c.was_emploee}\n`);
      });
    }

    console.log('========================================');
    if (notUpdated.length === 0 && existing.length === FORMER_EMPLOYEE_UUIDS.length) {
      console.log('  ✓✓✓ ALL UPDATED SUCCESSFULLY ✓✓✓');
    } else {
      console.log('  ⚠ REVIEW RESULTS ABOVE ⚠');
    }
    console.log('========================================\n');

    // Show sample of updated records
    console.log('Sample of updated former employees:');
    updated.slice(0, 5).forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.counteragent || c.name || 'N/A'}`);
      console.log(`   UUID: ${c.counteragent_uuid}`);
      console.log(`   is_emploee: ${c.is_emploee}`);
      console.log(`   was_emploee: ✓ true\n`);
    });

    if (updated.length > 5) {
      console.log(`... and ${updated.length - 5} more\n`);
    }

    // Summary statistics
    const currentEmployees = updated.filter(c => c.is_emploee === true);
    const formerOnly = updated.filter(c => c.is_emploee !== true && c.was_emploee === true);

    console.log('========================================');
    console.log('           STATISTICS');
    console.log('========================================\n');
    console.log(`Current employees (is_emploee=true): ${currentEmployees.length}`);
    console.log(`Former employees only (was_emploee=true, is_emploee=false): ${formerOnly.length}`);
    console.log(`Total marked as was_emploee: ${updated.length}\n`);

  } catch (error) {
    console.error('Error during update:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markAsFormerEmployees();
