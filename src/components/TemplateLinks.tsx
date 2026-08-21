"use client";

/**
 * Hàng nút tải file mẫu. Mẫu do /api/templates sinh ra ngay lúc bấm — nội dung
 * cột luôn khớp với bộ đọc đang chạy, không phải file tĩnh có thể lạc hậu.
 *
 * Danh sách nhãn để ở đây (không import từ lib/templates) vì module đó dựng file
 * .xlsx bằng node:zlib, không bundle được vào client.
 */

type Kind = "classify" | "benchmark" | "content";

const LABEL: Record<Kind, string> = {
  classify: "Mẫu file phân loại page",
  benchmark: "Mẫu báo cáo benchmark",
  content: "Mẫu báo cáo top content",
};

export default function TemplateLinks({ kinds, hint }: { kinds: Kind[]; hint?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{hint ?? "Chưa rõ định dạng?"}</span>
      {kinds.map((kind) => (
        <a
          key={kind}
          href={`/api/templates?kind=${kind}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            border: "1px solid var(--border-strong)",
            borderRadius: 7,
            fontSize: 11.5,
            fontWeight: 500,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden>↓</span>
          {LABEL[kind]}
        </a>
      ))}
    </div>
  );
}
