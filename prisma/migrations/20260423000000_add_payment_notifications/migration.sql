-- AlterTable
ALTER TABLE "User" ADD COLUMN "payment_notifications" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PaymentNotificationToken" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentNotificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotificationToken_uuid_key" ON "PaymentNotificationToken"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotificationToken_token_key" ON "PaymentNotificationToken"("token");

-- CreateIndex
CREATE INDEX "PaymentNotificationToken_token_idx" ON "PaymentNotificationToken"("token");

-- CreateIndex
CREATE INDEX "PaymentNotificationToken_user_id_idx" ON "PaymentNotificationToken"("user_id");

-- CreateIndex
CREATE INDEX "PaymentNotificationToken_payment_id_idx" ON "PaymentNotificationToken"("payment_id");

-- CreateIndex
CREATE INDEX "PaymentNotificationToken_expires_at_idx" ON "PaymentNotificationToken"("expires_at");

-- AddForeignKey
ALTER TABLE "PaymentNotificationToken" ADD CONSTRAINT "PaymentNotificationToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
