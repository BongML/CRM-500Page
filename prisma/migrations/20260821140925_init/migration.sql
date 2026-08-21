-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "aggPages" INTEGER NOT NULL DEFAULT 0,
    "aggViews" INTEGER NOT NULL DEFAULT 0,
    "aggReach" INTEGER NOT NULL DEFAULT 0,
    "aggRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aggPpi" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SubGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "follower" INTEGER NOT NULL,
    "posts" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "ppi" INTEGER NOT NULL,
    "views" INTEGER NOT NULL,
    "reach" INTEGER NOT NULL,
    "network" TEXT,
    "url" TEXT,
    "reportedAt" TIMESTAMP(3),
    "source" TEXT,
    "groupId" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopPost" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "rcs" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "reach" INTEGER NOT NULL,
    "ipi" DOUBLE PRECISION NOT NULL,
    "neg" DOUBLE PRECISION NOT NULL,
    "link" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pageRef" TEXT,
    "pageSlug" TEXT,
    "nicheId" TEXT NOT NULL,
    "pageId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TopPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trend" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "posts" INTEGER NOT NULL,
    "rate" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "nicheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Trend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "pages" INTEGER NOT NULL,
    "views" INTEGER NOT NULL,
    "reach" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "ppi" INTEGER NOT NULL,
    "nicheId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Niche_userId_idx" ON "Niche"("userId");

-- CreateIndex
CREATE INDEX "Group_userId_idx" ON "Group"("userId");

-- CreateIndex
CREATE INDEX "SubGroup_userId_idx" ON "SubGroup"("userId");

-- CreateIndex
CREATE INDEX "Page_groupId_idx" ON "Page"("groupId");

-- CreateIndex
CREATE INDEX "Page_subId_idx" ON "Page"("subId");

-- CreateIndex
CREATE INDEX "Page_nicheId_idx" ON "Page"("nicheId");

-- CreateIndex
CREATE INDEX "Page_userId_slug_idx" ON "Page"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Page_userId_ref_key" ON "Page"("userId", "ref");

-- CreateIndex
CREATE INDEX "TopPost_nicheId_idx" ON "TopPost"("nicheId");

-- CreateIndex
CREATE INDEX "TopPost_pageId_idx" ON "TopPost"("pageId");

-- CreateIndex
CREATE INDEX "TopPost_userId_pageRef_idx" ON "TopPost"("userId", "pageRef");

-- CreateIndex
CREATE UNIQUE INDEX "TopPost_userId_ref_key" ON "TopPost"("userId", "ref");

-- CreateIndex
CREATE INDEX "Trend_nicheId_idx" ON "Trend"("nicheId");

-- CreateIndex
CREATE INDEX "Trend_userId_idx" ON "Trend"("userId");

-- CreateIndex
CREATE INDEX "Snapshot_nicheId_takenAt_idx" ON "Snapshot"("nicheId", "takenAt");

-- CreateIndex
CREATE INDEX "Snapshot_userId_takenAt_idx" ON "Snapshot"("userId", "takenAt");

-- AddForeignKey
ALTER TABLE "Niche" ADD CONSTRAINT "Niche_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubGroup" ADD CONSTRAINT "SubGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubGroup" ADD CONSTRAINT "SubGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_subId_fkey" FOREIGN KEY ("subId") REFERENCES "SubGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopPost" ADD CONSTRAINT "TopPost_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopPost" ADD CONSTRAINT "TopPost_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopPost" ADD CONSTRAINT "TopPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
