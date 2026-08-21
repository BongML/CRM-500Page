import { PrismaClient } from "@prisma/client";

/**
 * Một PrismaClient dùng chung cho cả tiến trình.
 *
 * Trên serverless (Vercel) mỗi instance là một tiến trình riêng và bị gọi lại
 * nhiều lần khi còn "ấm" — giữ client trên globalThis **ở cả production** để lần
 * gọi sau dùng lại kết nối cũ thay vì mở thêm. Kết nối vẫn phải đi qua chuỗi
 * pooled của Neon (`-pooler` + pgbouncer=true&connection_limit=1), nếu không
 * pool của DB sẽ cạn khi nhiều instance cùng chạy.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
