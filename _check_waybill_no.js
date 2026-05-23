require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(async () => {
    const result = await c.query(`
      UPDATE rs_waybills_in_api api
      SET
        project_uuid        = COALESCE(api.project_uuid,        old.project_uuid),
        financial_code_uuid = COALESCE(api.financial_code_uuid, old.financial_code_uuid),
        corresponding_account = COALESCE(api.corresponding_account, old.corresponding_account)
      FROM (
        SELECT DISTINCT ON (rs_id)
          rs_id, project_uuid, financial_code_uuid, corresponding_account
        FROM rs_waybills_in
        WHERE rs_id IS NOT NULL
          AND (project_uuid IS NOT NULL OR financial_code_uuid IS NOT NULL OR corresponding_account IS NOT NULL)
        ORDER BY rs_id, project_uuid NULLS LAST, financial_code_uuid NULLS LAST
      ) old
      WHERE api.rs_id = old.rs_id
        AND (
          (api.project_uuid IS NULL AND old.project_uuid IS NOT NULL) OR
          (api.financial_code_uuid IS NULL AND old.financial_code_uuid IS NOT NULL) OR
          (api.corresponding_account IS NULL AND old.corresponding_account IS NOT NULL)
        )
    `);
    console.log('Updated:', result.rowCount, 'rows in rs_waybills_in_api');
    c.end();
  })
  .catch(e => { console.error(e.message); c.end(); });
