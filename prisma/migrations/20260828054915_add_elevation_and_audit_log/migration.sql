-- AlterTable
ALTER TABLE "CompetitionRace" ADD COLUMN "elevationGainM" REAL;

-- CreateTable
CREATE TABLE "CompetitionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "raceSnapshot" TEXT NOT NULL,
    "raceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "restoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CompetitionAuditLog_createdAt_idx" ON "CompetitionAuditLog"("createdAt");
