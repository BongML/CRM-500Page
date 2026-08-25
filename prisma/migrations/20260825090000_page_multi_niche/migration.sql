-- Một page có thể thuộc nhiều ngách: thay khóa ngoại `nicheId` bằng mảng id
-- `nicheIds`. Page đang có sẵn giữ nguyên ngách cũ, nay nằm ở vị trí đầu mảng
-- (vị trí "ngách chính").
ALTER TABLE "Page" ADD COLUMN "nicheIds" TEXT[];

UPDATE "Page" SET "nicheIds" = ARRAY["nicheId"];

ALTER TABLE "Page" DROP CONSTRAINT "Page_nicheId_fkey";
DROP INDEX "Page_nicheId_idx";
ALTER TABLE "Page" DROP COLUMN "nicheId";
