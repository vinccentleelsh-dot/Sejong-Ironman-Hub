-- CreateTable
CREATE TABLE "CourseAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "courseSnapshot" TEXT NOT NULL,
    "courseId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "restoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CourseAuditLog_createdAt_idx" ON "CourseAuditLog"("createdAt");
