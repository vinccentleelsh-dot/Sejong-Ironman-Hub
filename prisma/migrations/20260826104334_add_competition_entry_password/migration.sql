/*
  Warnings:

  - Added the required column `passwordHash` to the `CompetitionEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordSalt` to the `CompetitionEntry` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompetitionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "raceName" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "raceDate" DATETIME NOT NULL,
    "notes" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitionEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CompetitionEntry" ("createdAt", "discipline", "id", "memberId", "notes", "raceDate", "raceName") SELECT "createdAt", "discipline", "id", "memberId", "notes", "raceDate", "raceName" FROM "CompetitionEntry";
DROP TABLE "CompetitionEntry";
ALTER TABLE "new_CompetitionEntry" RENAME TO "CompetitionEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
