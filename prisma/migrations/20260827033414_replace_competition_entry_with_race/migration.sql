/*
  Warnings:

  - You are about to drop the `CompetitionEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CompetitionEntry";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CompetitionRace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateLabel" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "raceName" TEXT NOT NULL,
    "courseDetail" TEXT,
    "swimKm" REAL,
    "bikeKm" REAL,
    "runKm" REAL,
    "totalKmDisplay" TEXT,
    "participantsRaw" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CompetitionRace_startDate_idx" ON "CompetitionRace"("startDate");
