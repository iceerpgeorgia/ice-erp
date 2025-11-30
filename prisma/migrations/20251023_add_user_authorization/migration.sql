-- Add role, authorization fields to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS "isAuthorized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "authorizedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_isAuthorized_idx" ON "User"("isAuthorized");
