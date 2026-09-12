-- CreateTable
CREATE TABLE "PlatformVisit" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "userName" TEXT NOT NULL DEFAULT '',
    "userRole" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "referrer" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformVisit_createdAt_idx" ON "PlatformVisit"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformVisit_lastSeenAt_idx" ON "PlatformVisit"("lastSeenAt");

-- CreateIndex
CREATE INDEX "PlatformVisit_kind_createdAt_idx" ON "PlatformVisit"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformVisit_commune_createdAt_idx" ON "PlatformVisit"("commune", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformVisit_userId_createdAt_idx" ON "PlatformVisit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformVisit_visitorHash_path_createdAt_idx" ON "PlatformVisit"("visitorHash", "path", "createdAt");
