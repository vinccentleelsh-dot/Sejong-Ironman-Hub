/*
  Warnings:

  - Added the required column `updatedAt` to the `PointRule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PointRule" ("id", "label", "note", "points", "updatedAt") SELECT "id", "label", "note", "points", CURRENT_TIMESTAMP FROM "PointRule";
DROP TABLE "PointRule";
ALTER TABLE "new_PointRule" RENAME TO "PointRule";
CREATE UNIQUE INDEX "PointRule_label_key" ON "PointRule"("label");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
