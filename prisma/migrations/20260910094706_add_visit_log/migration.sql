-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "VisitLog_dateKey_idx" ON "VisitLog"("dateKey");

-- CreateIndex
CREATE INDEX "VisitLog_visitorId_idx" ON "VisitLog"("visitorId");
