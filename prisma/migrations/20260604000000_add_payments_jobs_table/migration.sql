-- CreateTable
CREATE TABLE "payments_jobs" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_uuid" TEXT NOT NULL,
    "job_uuid" UUID NOT NULL,
    "project_uuid" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_jobs_uuid_key" ON "payments_jobs"("uuid");

-- CreateIndex
CREATE INDEX "payments_jobs_payment_uuid_idx" ON "payments_jobs"("payment_uuid");

-- CreateIndex
CREATE INDEX "payments_jobs_job_uuid_idx" ON "payments_jobs"("job_uuid");

-- CreateIndex
CREATE INDEX "payments_jobs_project_uuid_idx" ON "payments_jobs"("project_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "payments_jobs_payment_uuid_job_uuid_project_uuid_key" ON "payments_jobs"("payment_uuid", "job_uuid", "project_uuid");

-- AddForeignKey
ALTER TABLE "payments_jobs" ADD CONSTRAINT "payments_jobs_payment_uuid_fkey" FOREIGN KEY ("payment_uuid") REFERENCES "payments"("record_uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_jobs" ADD CONSTRAINT "payments_jobs_job_uuid_fkey" FOREIGN KEY ("job_uuid") REFERENCES "jobs"("job_uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_jobs" ADD CONSTRAINT "payments_jobs_project_uuid_fkey" FOREIGN KEY ("project_uuid") REFERENCES "projects"("project_uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
