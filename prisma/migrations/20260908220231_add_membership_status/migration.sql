-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "membershipStatus" TEXT NOT NULL DEFAULT 'REGULAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME,
    "leftAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Member" ("createdAt", "id", "isActive", "joinedAt", "leftAt", "name", "updatedAt") SELECT "createdAt", "id", "isActive", "joinedAt", "leftAt", "name", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 기존 isActive=false(탈퇴 처리된) 회원은 새 상태값도 WITHDRAWN으로 맞춰준다 (나머지는
-- 컬럼 기본값 REGULAR 그대로 — 정확한 훈련회원/신입회원 구분은 운영자가 새 UI에서 직접 지정).
UPDATE "Member" SET "membershipStatus" = 'WITHDRAWN' WHERE "isActive" = false;
