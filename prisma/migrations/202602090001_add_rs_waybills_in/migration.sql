-- Create RS waybills inbound table
CREATE TABLE IF NOT EXISTS "rs_waybills_in" (
  id BIGSERIAL PRIMARY KEY,
  waybill_no TEXT,
  state TEXT,
  condition TEXT,
  category TEXT,
  type TEXT,
  counteragent TEXT,
  counteragent_inn TEXT,
  counteragent_name TEXT,
  counteragent_uuid UUID,
  vat BOOLEAN NOT NULL DEFAULT false,
  sum NUMERIC(20, 2),
  driver TEXT,
  driver_id TEXT,
  driver_uuid UUID,
  vehicle TEXT,
  transportation_sum NUMERIC(20, 2),
  departure_address TEXT,
  shipping_address TEXT,
  activation_time TIMESTAMP,
  transportation_beginning_time TIMESTAMP,
  submission_time TIMESTAMP,
  cancellation_time TIMESTAMP,
  note TEXT,
  vat_doc_id TEXT,
  stat TEXT,
  transportation_cost NUMERIC(20, 2),
  rs_id TEXT,
  project_uuid UUID,
  financial_code_uuid UUID,
  corresponding_account TEXT,
  date TEXT,
  period TEXT,
  import_batch_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_waybill_no ON "rs_waybills_in"(waybill_no);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_counteragent_inn ON "rs_waybills_in"(counteragent_inn);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_activation_time ON "rs_waybills_in"(activation_time);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_counteragent_uuid ON "rs_waybills_in"(counteragent_uuid);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_driver_uuid ON "rs_waybills_in"(driver_uuid);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_project_uuid ON "rs_waybills_in"(project_uuid);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_financial_code_uuid ON "rs_waybills_in"(financial_code_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS rs_waybills_in_rs_id_key ON "rs_waybills_in"(rs_id);
