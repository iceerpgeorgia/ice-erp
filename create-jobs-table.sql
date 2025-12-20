-- Create jobs table
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  job_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  project_uuid UUID NOT NULL,
  job_name TEXT NOT NULL,
  floors INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  is_ff BOOLEAN NOT NULL DEFAULT false,
  brand_id BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_jobs_job_uuid ON jobs(job_uuid);
CREATE INDEX idx_jobs_project_uuid ON jobs(project_uuid);
CREATE INDEX idx_jobs_brand_id ON jobs(brand_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_jobs_updated_at();
