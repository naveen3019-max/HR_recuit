-- Update any existing NULL linkedinUrl rows before adding NOT NULL constraint
UPDATE "Employee" SET "linkedinUrl" = '' WHERE "linkedinUrl" IS NULL;

-- AlterTable: Make linkedinUrl mandatory, add platform tracking fields
ALTER TABLE "Employee" ALTER COLUMN "linkedinUrl" SET NOT NULL;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "platformsFlagged" TEXT[] DEFAULT '{}';
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "platformProfiles" JSONB;
