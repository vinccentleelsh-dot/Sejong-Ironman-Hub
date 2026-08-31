-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "notes" TEXT,
    "startDTRaw" TEXT,
    "startDT" DATETIME,
    "totalKm" REAL NOT NULL,
    "gainM" REAL NOT NULL,
    "cpCount" INTEGER NOT NULL,
    "hasCutoff" BOOLEAN NOT NULL,
    "cpSource" TEXT NOT NULL,
    "paceModel" TEXT NOT NULL,
    "trackJson" TEXT NOT NULL,
    "cpsJson" TEXT NOT NULL,
    "peaksJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PointRule" ("id", "label", "note", "points", "updatedAt") SELECT "id", "label", "note", "points", "updatedAt" FROM "PointRule";
DROP TABLE "PointRule";
ALTER TABLE "new_PointRule" RENAME TO "PointRule";
CREATE UNIQUE INDEX "PointRule_label_key" ON "PointRule"("label");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Course_createdAt_idx" ON "Course"("createdAt");
