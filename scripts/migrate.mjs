import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/**
 * Chạy `prisma migrate deploy` lúc build, nhưng tự dò biến môi trường trước.
 *
 * Lý do tồn tại: schema khai báo hai chuỗi kết nối — `DATABASE_URL` (pooled, cho
 * runtime) và `DIRECT_URL` (direct, bắt buộc để chạy migration vì PgBouncer
 * không chạy được DDL trong transaction). Trên Vercel, tùy cách nối DB mà tên
 * biến khác nhau:
 *
 *  - tự thêm tay      → DATABASE_URL / DIRECT_URL
 *  - integration Neon → DATABASE_URL / DATABASE_URL_UNPOOLED
 *  - Vercel Postgres  → POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING
 *
 * Thiếu đúng một biến là cả lần deploy hỏng với thông báo khó đoán, nên ở đây
 * dò theo mọi tên quen thuộc, và cuối cùng suy ra chuỗi direct từ chuỗi pooled
 * (Neon chỉ khác nhau ở chữ "-pooler" trong hostname).
 */

const POOLED_KEYS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];
const DIRECT_KEYS = [
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_DATABASE_URL",
];

/**
 * Nạp .env khi chạy ở máy local. Trên Vercel không có file này — biến đến thẳng
 * từ môi trường — nhưng Node (khác Prisma CLI) không tự đọc .env, nên thiếu
 * bước này thì `npm run build` ở local sẽ báo thiếu biến dù .env có đủ.
 */
function loadDotEnv(file = ".env") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue; // biến thật luôn thắng file
    process.env[key] = raw.trim().replace(/^["']|["']$/g, "");
  }
}

loadDotEnv();

const pick = (keys) => keys.map((k) => process.env[k]).find((v) => v && v.trim());

/** Chuỗi pooled → chuỗi direct: bỏ "-pooler" và các tham số chỉ dành cho pool. */
function deriveDirect(url) {
  const [base, query = ""] = url.split("?");
  const host = base.replace("-pooler.", ".");
  const params = query
    .split("&")
    .filter((p) => p && !/^(pgbouncer|connection_limit|pool_timeout)=/.test(p));
  return params.length ? `${host}?${params.join("&")}` : host;
}

const pooled = pick(POOLED_KEYS);
if (!pooled) {
  console.error(
    `\n[migrate] Thiếu chuỗi kết nối DB. Đặt một trong: ${POOLED_KEYS.join(", ")}` +
      `\n[migrate] Trên Vercel: Settings > Environment Variables (nhớ tick cả Production lẫn Preview).\n`,
  );
  process.exit(1);
}

let direct = pick(DIRECT_KEYS);
if (!direct) {
  direct = deriveDirect(pooled);
  console.log("[migrate] Không thấy DIRECT_URL — suy ra chuỗi direct từ chuỗi pooled.");
}

process.env.DATABASE_URL = pooled;
process.env.DIRECT_URL = direct;

const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(res.status ?? 1);
