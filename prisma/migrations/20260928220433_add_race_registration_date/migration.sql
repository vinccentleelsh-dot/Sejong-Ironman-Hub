-- AlterTable
ALTER TABLE "CompetitionRace" ADD COLUMN "registrationDate" DATETIME;
ALTER TABLE "CompetitionRace" ADD COLUMN "registrationDateLabel" TEXT;

-- CreateIndex
CREATE INDEX "CompetitionRace_registrationDate_idx" ON "CompetitionRace"("registrationDate");
