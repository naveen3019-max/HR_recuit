ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "employeeCode" TEXT,
ADD COLUMN IF NOT EXISTS "linkedinUsername" TEXT,
ADD COLUMN IF NOT EXISTS "department" TEXT,
ADD COLUMN IF NOT EXISTS "experience" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "performanceScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "engagementScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "attendanceScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "managerConcern" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "marketSalary" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "resumeUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "linkedinUpdatedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Employee_employeeCode_key'
  ) THEN
    CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EmployeeSignal" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "signalType" TEXT NOT NULL,
  "signalValue" TEXT NOT NULL,
  "detectedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttritionRisk" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "aiExplanation" TEXT,
  "recommendation" TEXT,
  "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttritionRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RetentionAction" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "hrId" INTEGER,
  "actionType" TEXT NOT NULL,
  "notes" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionAction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'AttritionRisk_employeeId_key'
  ) THEN
    CREATE UNIQUE INDEX "AttritionRisk_employeeId_key" ON "AttritionRisk"("employeeId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EmployeeSignal_employeeId_idx" ON "EmployeeSignal"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeSignal_signalType_idx" ON "EmployeeSignal"("signalType");
CREATE INDEX IF NOT EXISTS "EmployeeSignal_detectedDate_idx" ON "EmployeeSignal"("detectedDate");
CREATE INDEX IF NOT EXISTS "AttritionRisk_riskLevel_idx" ON "AttritionRisk"("riskLevel");
CREATE INDEX IF NOT EXISTS "AttritionRisk_riskScore_idx" ON "AttritionRisk"("riskScore");
CREATE INDEX IF NOT EXISTS "RetentionAction_employeeId_idx" ON "RetentionAction"("employeeId");
CREATE INDEX IF NOT EXISTS "RetentionAction_hrId_idx" ON "RetentionAction"("hrId");
CREATE INDEX IF NOT EXISTS "RetentionAction_date_idx" ON "RetentionAction"("date");

ALTER TABLE "EmployeeSignal"
ADD CONSTRAINT "EmployeeSignal_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttritionRisk"
ADD CONSTRAINT "AttritionRisk_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetentionAction"
ADD CONSTRAINT "RetentionAction_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetentionAction"
ADD CONSTRAINT "RetentionAction_hrId_fkey"
FOREIGN KEY ("hrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
