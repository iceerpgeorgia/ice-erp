// Verify that specific counteragent UUIDs have is_emploee=true in Supabase
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMPLOYEE_UUIDS = [
  '5beea027-bf57-4c93-aabc-21fd42f223a5',
  'a26dce96-c08f-453e-9e26-10aaf72d142a',
  'ad901e05-add9-42de-89ba-4d9a21c89bcf',
  '401318ca-bf39-49c3-9bdc-73836a8f9774',
  '0c7f8db5-32e0-420b-b059-ca204377f0f3',
  'a703de60-7255-40f6-bcd1-b990ca15c2b4',
  'ed0d2b6c-6b7a-4c51-b69c-0dfd85113ee6',
  'a778537a-20bd-4af4-b7e0-06811f6672a1',
  '6187c79d-6113-4785-87ea-928b9f26f591',
  '19521391-5237-486e-b9f6-c4529f6d8e1d',
  '01dfe71d-5350-4a02-abcd-c6a3c15b94ee',
  'c5d1f87d-8c4d-42c3-8e4a-b47a5a7d4d4a',
  '3b93819d-e8a3-4430-bb78-d29b6a132d24',
  '86332895-c3c3-4313-aa1c-0d1b06c2386c',
  'c309cb7c-404d-431a-a8fb-29671dca0c49',
  '43ce8ab0-af16-4d2f-bbec-8de2c7e3a31f',
  'd239bca7-c0e0-431b-8055-6778fa312a38',
  'a68c7c4e-5733-44e9-ac09-eba7f2ff82bc',
  'a19dbe70-93e6-453b-840f-63a4c42291dc',
  'c247edba-fd51-4a47-8765-f7ea1a0a9459',
  '71dc3050-596a-4c1c-b6fe-34fc2b09bf85',
  'f7212416-445a-4f9d-b4aa-1427dd9dfc06',
  '48c5647f-1795-4315-9f87-d01765033029',
  '26c8f42b-baf8-4a8f-8c54-f9085d5e1da6',
  '47272651-c703-4d0d-9210-7df4f6490134',
  'acbc2fb2-b331-42f1-b862-1d9ded071b71',
  '9a0733fd-8be0-457e-a464-28bbbc4262f9',
  'fc664b80-3a93-44a0-87ea-ee9b500c2cfe',
  '60ce351b-2645-4b02-a392-e87ab130825d',
  'a7a68aed-8bdf-4711-b39b-97b36e9c36ac',
  '8325fd25-433c-45b8-9de3-def4af5c7bd3',
  '0e4dafa9-9117-434c-860d-c8f52edfdd30',
  '2792760e-0f83-4e89-af39-83e472f42919',
  '12294eb0-e5da-4b5b-a62c-1704bca1ed4d',
  '293428bc-4e95-4bbc-87ea-1ec4c6e8cf0f',
  'e88993f4-b0f5-4ed2-82b1-12459c89f8a0',
  '489f2ee4-9c4d-4909-8b54-37d86935386e',
  '25eedbb9-8276-4d6f-9bae-70b3ac50ef1a',
  '9c4e431e-bf60-4668-96be-fe3f9b8c4066',
  'f226abbb-d682-476f-9fea-3665c62bccb6',
  '785092a8-3bc0-474e-9eda-1a29305a7200',
  'fb021eff-22cf-4ce7-9500-b3b54c3cd121',
  '3c8772d6-ed17-4a44-94bd-f19d09baa79d',
  '4e269043-dda6-40ba-af1d-bc69ff12ef7f',
  '7f6f0e56-1263-4322-8a5d-4dec80656746',
  '5cd6a71a-39ea-4bfa-a786-c5163a91043c',
  'fd6be193-fd0d-47e3-96b1-e5a6e1948c27',
  'a0a1bbba-f746-4ced-9ab8-bc82640bc32e',
  '3a916189-abb9-43d1-a31f-9ce154f571a1',
  '4c25a3b7-d112-4c46-aa9a-b2513a44f1b7',
  '91b9a6d9-53e8-47be-9a3e-b3f8b656107f',
  '08ba1560-695e-4a63-9fc4-7771d23cff66',
  'b1054aac-1e32-4d92-b641-5ab23b7a4174',
  '50abe5ec-690f-4dfe-90c9-00c1e045d831',
  'd8ae9a32-9c1a-49be-a288-c35ba124d395',
  '7126c8ef-1c57-476b-ab3a-e09dae0e37d3',
  '915594ff-dc6c-42e1-8737-399c784f652e',
  '7a12686c-fcc6-4984-8f41-fa41d3036c63',
  '4436b199-616d-40ac-a8cc-728556e7d36b',
  '24ae9885-4a9f-42b9-85c1-a053dedd5a2b',
  '1b5f7d32-b4f7-4791-a919-15abcf66b09e',
  '4649ee99-5c78-455b-b32e-db679c78ead3',
  '933f1c87-5084-423d-be28-3ed5db316885',
  'c202fc32-c675-4f80-8903-9eaa1284acc3',
  'df89aa2b-3c0f-4383-aaad-b0349a4b7bb1',
  'b9a50d34-5467-4b58-a3dc-223cebf956ed',
  '3d6a0e9c-f2e6-4f5e-911e-f352f4183431',
  '9c37f282-85f8-45b3-b124-76797efa08b4',
  '6e282403-3071-48ba-849f-c1ebf0f013f0',
  'da383c83-1644-414d-a6d7-428e9978ea67',
  'dbc5b832-802e-49bf-a64f-427198596cbb',
  'e4215a7c-6a0f-4f44-8ef4-4c9c4bb33272',
  '8aae6c15-d161-4e49-b9e9-031df8dd13cf',
  'e8d68d39-496a-496b-91ab-43ceb685818c',
  '8832aaff-f2ae-44e8-876a-e1b1b305b48c',
  '6d685bc0-ac9d-40a8-bd39-c3df8f5dea9e',
  '213967bc-2278-41b5-b5cb-23abf5a24f61',
  '3d67e166-bcab-404e-af40-baa50d123c31',
  '8fec1a92-20c1-4604-9a9a-37f2c3b79693',
  'b905cc41-c84b-443c-b5a6-3fa4e4798f87',
  '0c2c2d6a-b87c-4108-b80f-47102d8342b2',
  '2f50e082-4b99-45a9-8ec5-85347ceb63c4',
  '5ba9f649-5e81-4adc-8722-f0f54a2b2f69',
  'ecac5bb8-ce34-4e8a-ab66-bc8747d0c720',
  '4ebebc08-623c-4d6f-9ca0-941af04d308d',
  '69ad19f4-4fc9-408d-9d3e-bbd2dbfce8ca',
  'c72e058b-66f6-405b-8190-b42cf7b8f157',
  'c2d94caa-7b1a-4b3c-a918-4a58359b59d2',
  '55b22874-efdd-4b64-820b-84b65b299a1d',
  '500d717f-e9f4-4f90-9c02-fae0e40f456e',
  '4bcc1916-9e7e-4691-ae0b-90205ae51dd9',
  '8fdc0a51-ff20-4042-9657-e67bdad96637',
  'ae6f4d15-31f7-4318-b9dc-9bfb194238f6',
  '1b0bdf2f-40a9-40d4-a35f-02034493c16b'
];

async function verifyEmployeeStatus() {
  console.log('\n========================================');
  console.log('  EMPLOYEE UUID VERIFICATION');
  console.log('========================================\n');
  console.log(`Checking ${EMPLOYEE_UUIDS.length} UUIDs in Supabase...\n`);

  try {
    // Fetch all counteragents with these UUIDs
    const counteragents = await prisma.counteragents.findMany({
      where: {
        counteragent_uuid: {
          in: EMPLOYEE_UUIDS
        }
      },
      select: {
        id: true,
        counteragent_uuid: true,
        name: true,
        counteragent: true,
        is_emploee: true,
        is_active: true
      }
    });

    console.log(`Found: ${counteragents.length} / ${EMPLOYEE_UUIDS.length} counteragents\n`);

    // Categorize results
    const correctlyMarked = counteragents.filter(c => c.is_emploee === true);
    const notMarkedAsEmployee = counteragents.filter(c => c.is_emploee !== true);
    const notFound = EMPLOYEE_UUIDS.filter(
      uuid => !counteragents.find(c => c.counteragent_uuid === uuid)
    );

    // Display results
    console.log('========================================');
    console.log('           SUMMARY');
    console.log('========================================\n');
    
    console.log(`✓ Correctly marked as employee: ${correctlyMarked.length}`);
    console.log(`✗ NOT marked as employee: ${notMarkedAsEmployee.length}`);
    console.log(`? Not found in database: ${notFound.length}\n`);

    // Show details for incorrectly marked
    if (notMarkedAsEmployee.length > 0) {
      console.log('========================================');
      console.log('  NOT MARKED AS EMPLOYEE (is_emploee ≠ true)');
      console.log('========================================\n');
      notMarkedAsEmployee.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.counteragent || c.name || 'N/A'}`);
        console.log(`   UUID: ${c.counteragent_uuid}`);
        console.log(`   ID: ${c.id}`);
        console.log(`   is_emploee: ${c.is_emploee}`);
        console.log(`   is_active: ${c.is_active}\n`);
      });
    }

    // Show not found UUIDs
    if (notFound.length > 0) {
      console.log('========================================');
      console.log('  NOT FOUND IN DATABASE');
      console.log('========================================\n');
      notFound.forEach((uuid, idx) => {
        console.log(`${idx + 1}. ${uuid}`);
      });
      console.log('');
    }

    // Show correctly marked (sample)
    if (correctlyMarked.length > 0) {
      console.log('========================================');
      console.log('  CORRECTLY MARKED AS EMPLOYEE (Sample)');
      console.log('========================================\n');
      correctlyMarked.slice(0, 10).forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.counteragent || c.name || 'N/A'}`);
        console.log(`   UUID: ${c.counteragent_uuid}`);
        console.log(`   is_emploee: ✓ true\n`);
      });
      if (correctlyMarked.length > 10) {
        console.log(`... and ${correctlyMarked.length - 10} more\n`);
      }
    }

    // Final status
    console.log('========================================');
    if (notMarkedAsEmployee.length === 0 && notFound.length === 0) {
      console.log('  ✓✓✓ ALL VERIFIED SUCCESSFULLY ✓✓✓');
    } else {
      console.log('  ⚠ ISSUES FOUND - NEEDS ATTENTION ⚠');
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyEmployeeStatus();
