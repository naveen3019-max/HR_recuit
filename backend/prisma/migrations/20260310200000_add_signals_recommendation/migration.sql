-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "signalsDetected" TEXT[] DEFAULT '{}';
ALTER TABLE "Employee" ADD COLUMN "recommendation" TEXT;
