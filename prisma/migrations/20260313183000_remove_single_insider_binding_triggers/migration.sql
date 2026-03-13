-- Remove legacy single-insider binding triggers so records keep explicitly selected insider_uuid values.

DROP TRIGGER IF EXISTS trg_bind_single_insider_bank_accounts ON bank_accounts;
DROP TRIGGER IF EXISTS trg_bind_single_insider_inventories ON inventories;
DROP TRIGGER IF EXISTS trg_bind_single_insider_jobs ON jobs;
DROP TRIGGER IF EXISTS trg_bind_single_insider_payments ON payments;
DROP TRIGGER IF EXISTS trg_bind_single_insider_payments_ledger ON payments_ledger;
DROP TRIGGER IF EXISTS trg_bind_single_insider_projects ON projects;
DROP TRIGGER IF EXISTS trg_bind_single_insider_rs_waybills_in ON rs_waybills_in;
DROP TRIGGER IF EXISTS trg_bind_single_insider_rs_waybills_in_items ON rs_waybills_in_items;
DROP TRIGGER IF EXISTS trg_bind_single_insider_salary_accruals ON salary_accruals;
DROP TRIGGER IF EXISTS trg_bind_single_insider_conversion ON conversion;
DROP TRIGGER IF EXISTS trg_bind_single_insider_conversion_entries ON conversion_entries;

DROP FUNCTION IF EXISTS bind_single_required_insider_uuid();
