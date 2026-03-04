const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const surplusInsuranceValues = [
  ['5beea027-bf57-4c93-aabc-21fd42f223a5', 95.0],
  ['a26dce96-c08f-453e-9e26-10aaf72d142a', 95.0],
  ['ad901e05-add9-42de-89ba-4d9a21c89bcf', 95.0],
  ['401318ca-bf39-49c3-9bdc-73836a8f9774', 95.0],
  ['0c7f8db5-32e0-420b-b059-ca204377f0f3', 95.0],
  ['a703de60-7255-40f6-bcd1-b990ca15c2b4', 95.0],
  ['ed0d2b6c-6b7a-4c51-b69c-0dfd85113ee6', 95.0],
  ['a778537a-20bd-4af4-b7e0-06811f6672a1', 95.0],
  ['6187c79d-6113-4785-87ea-928b9f26f591', 95.0],
  ['19521391-5237-486e-b9f6-c4529f6d8e1d', 130.0],
  ['01dfe71d-5350-4a02-abcd-c6a3c15b94ee', 95.0],
  ['3b93819d-e8a3-4430-bb78-d29b6a132d24', 95.0],
  ['86332895-c3c3-4313-aa1c-0d1b06c2386c', 95.0],
  ['c309cb7c-404d-431a-a8fb-29671dca0c49', 95.0],
  ['43ce8ab0-af16-4d2f-bbec-8de2c7e3a31f', 95.0],
  ['a68c7c4e-5733-44e9-ac09-eba7f2ff82bc', 95.0],
  ['a19dbe70-93e6-453b-840f-63a4c42291dc', 95.0],
  ['acbc2fb2-b331-42f1-b862-1d9ded071b71', 95.0],
  ['60ce351b-2645-4b02-a392-e87ab130825d', 95.0],
  ['489f2ee4-9c4d-4909-8b54-37d86935386e', 95.0],
  ['f226abbb-d682-476f-9fea-3665c62bccb6', 95.0],
  ['785092a8-3bc0-474e-9eda-1a29305a7200', 95.0],
  ['3c8772d6-ed17-4a44-94bd-f19d09baa79d', 95.0],
  ['4e269043-dda6-40ba-af1d-bc69ff12ef7f', 95.0],
  ['5cd6a71a-39ea-4bfa-a786-c5163a91043c', 95.0],
  ['fd6be193-fd0d-47e3-96b1-e5a6e1948c27', 95.0],
  ['4c25a3b7-d112-4c46-aa9a-b2513a44f1b7', 95.0],
  ['91b9a6d9-53e8-47be-9a3e-b3f8b656107f', 95.0],
  ['08ba1560-695e-4a63-9fc4-7771d23cff66', 95.0],
  ['b1054aac-1e32-4d92-b641-5ab23b7a4174', 95.0],
  ['7126c8ef-1c57-476b-ab3a-e09dae0e37d3', 95.0],
  ['7a12686c-fcc6-4984-8f41-fa41d3036c63', 95.0],
  ['4436b199-616d-40ac-a8cc-728556e7d36b', 95.0],
  ['24ae9885-4a9f-42b9-85c1-a053dedd5a2b', 95.0],
  ['1b5f7d32-b4f7-4791-a919-15abcf66b09e', 95.0],
  ['933f1c87-5084-423d-be28-3ed5db316885', 95.0],
  ['c202fc32-c675-4f80-8903-9eaa1284acc3', 95.0],
  ['b9a50d34-5467-4b58-a3dc-223cebf956ed', 95.0],
  ['9c37f282-85f8-45b3-b124-76797efa08b4', 95.0],
  ['6e282403-3071-48ba-849f-c1ebf0f013f0', 95.0],
  ['e4215a7c-6a0f-4f44-8ef4-4c9c4bb33272', 95.0],
  ['8aae6c15-d161-4e49-b9e9-031df8dd13cf', 95.0],
  ['e8d68d39-496a-496b-91ab-43ceb685818c', 95.0],
  ['8832aaff-f2ae-44e8-876a-e1b1b305b48c', 95.0],
  ['6d685bc0-ac9d-40a8-bd39-c3df8f5dea9e', 95.0],
  ['213967bc-2278-41b5-b5cb-23abf5a24f61', 95.0],
  ['3d67e166-bcab-404e-af40-baa50d123c31', 95.0],
  ['8fec1a92-20c1-4604-9a9a-37f2c3b79693', 95.0],
  ['b905cc41-c84b-443c-b5a6-3fa4e4798f87', 95.0],
  ['2f50e082-4b99-45a9-8ec5-85347ceb63c4', 95.0],
  ['ecac5bb8-ce34-4e8a-ab66-bc8747d0c720', 95.0],
  ['4ebebc08-623c-4d6f-9ca0-941af04d308d', 95.0],
  ['69ad19f4-4fc9-408d-9d3e-bbd2dbfce8ca', 95.0],
  ['c2d94caa-7b1a-4b3c-a918-4a58359b59d2', 95.0],
  ['55b22874-efdd-4b64-820b-84b65b299a1d', 95.0],
  ['500d717f-e9f4-4f90-9c02-fae0e40f456e', 95.0],
  ['ae6f4d15-31f7-4318-b9dc-9bfb194238f6', 95.0],
  ['1b0bdf2f-40a9-40d4-a35f-02034493c16b', 95.0],
];

(async () => {
  try {
    const start = new Date('2026-02-01T00:00:00.000Z');
    const end = new Date('2026-03-01T00:00:00.000Z');

    let updatedRows = 0;
    const notFound = [];

    for (const [counteragentUuid, surplusInsurance] of surplusInsuranceValues) {
      const result = await prisma.salary_accruals.updateMany({
        where: {
          salary_month: { gte: start, lt: end },
          counteragent_uuid: counteragentUuid,
        },
        data: {
          surplus_insurance: surplusInsurance,
          updated_at: new Date(),
          updated_by: 'manual-script',
        },
      });

      updatedRows += result.count;
      if (result.count === 0) {
        notFound.push(counteragentUuid);
      }
    }

    const rowsWithSurplusInsurance = await prisma.salary_accruals.count({
      where: {
        salary_month: { gte: start, lt: end },
        surplus_insurance: { not: null },
      },
    });

    console.log(
      JSON.stringify(
        {
          input_counteragents: surplusInsuranceValues.length,
          updated_rows: updatedRows,
          feb_rows_with_surplus_insurance: rowsWithSurplusInsurance,
          unmatched_counteragents: notFound,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
