-- Bảng đệm cho file tải lên nhiều mảnh. Nền tảng serverless chặn body request
-- quá ~4.5MB nên file lớn được client cắt nhỏ, gửi từng mảnh rồi ghép lại lúc
-- nhập. Bản ghi chỉ sống vài phút (xem lib/upload.ts).
CREATE TABLE "UploadPart" (
    "uploadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UploadPart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadPart_userId_uploadId_index_key" ON "UploadPart"("userId", "uploadId", "index");

CREATE INDEX "UploadPart_createdAt_idx" ON "UploadPart"("createdAt");

ALTER TABLE "UploadPart" ADD CONSTRAINT "UploadPart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
