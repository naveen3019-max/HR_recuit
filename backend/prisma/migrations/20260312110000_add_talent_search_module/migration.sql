CREATE TABLE "TalentSearch" (
  "id" SERIAL NOT NULL,
  "recruiterId" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "experienceRequired" TEXT,
  "location" TEXT,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "industry" TEXT,
  "additionalRequirements" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TalentSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TalentSearchMatch" (
  "id" SERIAL NOT NULL,
  "talentSearchId" INTEGER NOT NULL,
  "candidateId" INTEGER NOT NULL,
  "matchScore" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "recommendedRole" TEXT NOT NULL,
  "roleFit" TEXT,
  "shortlisted" BOOLEAN NOT NULL DEFAULT false,
  "exported" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TalentSearchMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentSearch_recruiterId_idx" ON "TalentSearch"("recruiterId");
CREATE INDEX "TalentSearch_createdAt_idx" ON "TalentSearch"("createdAt");
CREATE INDEX "TalentSearchMatch_candidateId_idx" ON "TalentSearchMatch"("candidateId");
CREATE INDEX "TalentSearchMatch_matchScore_idx" ON "TalentSearchMatch"("matchScore");

CREATE UNIQUE INDEX "TalentSearchMatch_talentSearchId_candidateId_key" ON "TalentSearchMatch"("talentSearchId", "candidateId");

ALTER TABLE "TalentSearch"
ADD CONSTRAINT "TalentSearch_recruiterId_fkey"
FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TalentSearchMatch"
ADD CONSTRAINT "TalentSearchMatch_talentSearchId_fkey"
FOREIGN KEY ("talentSearchId") REFERENCES "TalentSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TalentSearchMatch"
ADD CONSTRAINT "TalentSearchMatch_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
