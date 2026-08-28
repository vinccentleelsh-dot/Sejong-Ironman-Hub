-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "disciplines" TEXT,
    "title" TEXT,
    "description" TEXT,
    "leaderName" TEXT,
    "supportName" TEXT,
    "swimKm" REAL NOT NULL DEFAULT 0,
    "bikeKm" REAL NOT NULL DEFAULT 0,
    "runKm" REAL NOT NULL DEFAULT 0,
    "seasonPhase" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TrainingSession" ("bikeKm", "category", "createdAt", "date", "description", "disciplines", "id", "leaderName", "runKm", "seasonPhase", "supportName", "swimKm", "title", "updatedAt") SELECT "bikeKm", "category", "createdAt", "date", "description", "disciplines", "id", "leaderName", "runKm", "seasonPhase", "supportName", "swimKm", "title", "updatedAt" FROM "TrainingSession";
DROP TABLE "TrainingSession";
ALTER TABLE "new_TrainingSession" RENAME TO "TrainingSession";
CREATE INDEX "TrainingSession_date_idx" ON "TrainingSession"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
