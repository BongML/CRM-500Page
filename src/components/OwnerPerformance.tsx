"use client";

import { useMemo, useState } from "react";
import { avatarBg, initials, int, vShort } from "@/lib/format";
import { btnMini, cardHint, cardTitle, tnum } from "@/lib/ui";
import { statsByOwner } from "@/lib/metrics";
import type { Niche, Owner, Page } from "@/lib/types";
import { NicheDot } from "./Atoms";

/** Số ngách hiện tên trước khi gộp phần còn lại vào "+N". */
const NICHE_CHIPS = 4;

type SortKey = "posts" | "niches" | "views";

const COLS: { key: SortKey; label: string; hint: string }[] = [
  { key: "posts", label: "Tổng bài đăng", hint: "Tổng số bài của toàn bộ page người này nắm, trong kỳ báo cáo" },
  { key: "niches", label: "Ngách đã triển khai", hint: "Số ngách thực sự có page — ngách tạo ra mà chưa có page nào thì không tính" },
  { key: "views", label: "Tổng views", hint: "Tổng lượt xem của cả hệ thống kênh người này đang nắm" },
];

/**
 * Hiệu suất page của từng **người nắm** — chỉ hiện khi tài khoản tổng đang xem
 * gộp toàn hệ thống, vì ở phạm vi một tài khoản thì mọi page đều cùng một người
 * nắm nên bảng chỉ có đúng một dòng, vô nghĩa.
 *
 * Ba thông số theo đúng yêu cầu vận hành: **tổng số bài đăng**, **các ngách đã
 * triển khai** và **tổng views của hệ thống kênh**. Cột views kèm thanh tỉ
 * trọng để thấy ngay ai đang gánh phần lớn lượt xem của cả hệ thống.
 *
 * Bấm "Mở dữ liệu" là bước hẳn vào không gian của người đó (đổi phạm vi), nên
 * mọi màn còn lại — kể cả biểu đồ tăng trưởng — hiện đúng số liệu riêng của họ.
 */
export default function OwnerPerformance({
  pages,
  niches,
  owners,
  onOpenOwner,
}: {
  pages: Page[];
  niches: Niche[];
  owners: Owner[];
  /** Đổi phạm vi dữ liệu sang người nắm này. */
  onOpenOwner?: (userId: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("views");

  const rows = useMemo(() => statsByOwner(pages, owners), [pages, owners]);

  const sorted = useMemo(() => {
    const val = (r: (typeof rows)[number]) =>
      sort === "posts" ? r.stats.posts : sort === "niches" ? r.stats.nicheIds.length : r.stats.views;
    return [...rows].sort((a, b) => val(b) - val(a));
  }, [rows, sort]);

  const total = useMemo(
    () => ({
      posts: rows.reduce((s, r) => s + r.stats.posts, 0),
      views: rows.reduce((s, r) => s + r.stats.views, 0),
      // Ngách trùng tên giữa hai tài khoản vẫn là hai bản ghi khác nhau, nên
      // tổng toàn hệ thống là số ngách đang có page, không phải tổng các dòng.
      niches: new Set(pages.map((p) => p.nicheId)).size,
    }),
    [rows, pages],
  );

  /** Ngách đã triển khai của một người nắm, bỏ ngách đã bị xóa khỏi hệ thống. */
  const nichesOf = (ids: string[]) =>
    ids
      .map((id) => niches.find((n) => n.id === id))
      .filter((n): n is Niche => !!n)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  if (!owners.length) return null;

  const th = {
    padding: "9px 12px",
    fontWeight: 600,
    fontSize: 11.5,
    color: "var(--muted)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap" as const,
  };

  const td = {
    padding: "11px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12.5,
    verticalAlign: "middle" as const,
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "15px 18px 12px",
        }}
      >
        <div style={cardTitle}>Hiệu suất page người nắm</div>
        <div style={cardHint}>
          {int(owners.length)} người nắm · {int(total.posts)} bài · {total.niches} ngách ·{" "}
          {vShort(total.views)} views
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Người nắm</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  style={{
                    ...th,
                    textAlign: c.key === "niches" ? "left" : "right",
                    color: sort === c.key ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <button
                    onClick={() => setSort(c.key)}
                    title={`${c.hint} · bấm để sắp xếp`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      font: "inherit",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {c.label}
                    {sort === c.key ? " ↓" : ""}
                  </button>
                </th>
              ))}
              <th style={{ ...th, textAlign: "right" }} />
            </tr>
          </thead>

          <tbody>
            {sorted.map(({ owner, stats }) => {
              const list = nichesOf(stats.nicheIds);
              const share = total.views ? (stats.views / total.views) * 100 : 0;

              return (
                <tr key={owner.id} className="row-hover">
                  {/* Người nắm */}
                  <td style={{ ...td, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 28,
                          height: 28,
                          flex: "none",
                          borderRadius: 8,
                          background: avatarBg(owner.name || owner.email),
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {initials(owner.name || owner.email)}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600 }}>
                          {owner.name || owner.email}
                        </span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>
                          {int(stats.pages)} page
                          {stats.silent > 0 ? ` · ${int(stats.silent)} page không đăng bài` : ""}
                        </span>
                      </span>
                    </div>
                  </td>

                  {/* 1 — Tổng số bài đăng */}
                  <td style={{ ...td, textAlign: "right", ...tnum }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{int(stats.posts)}</span>
                  </td>

                  {/* 2 — Các ngách đã triển khai */}
                  <td style={{ ...td, minWidth: 240 }}>
                    {list.length === 0 ? (
                      <span style={{ color: "var(--faint)" }}>chưa triển khai ngách nào</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, ...tnum }}>{list.length}</span>
                        {list.slice(0, NICHE_CHIPS).map((n) => (
                          <span
                            key={n.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "2px 8px",
                              borderRadius: 20,
                              border: "1px solid var(--border)",
                              fontSize: 11,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <NicheDot color={n.color} size={7} />
                            {n.name}
                          </span>
                        ))}
                        {list.length > NICHE_CHIPS && (
                          <span
                            title={list
                              .slice(NICHE_CHIPS)
                              .map((n) => n.name)
                              .join(", ")}
                            style={{ fontSize: 11, color: "var(--muted)" }}
                          >
                            +{list.length - NICHE_CHIPS}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 3 — Tổng views của hệ thống kênh */}
                  <td style={{ ...td, textAlign: "right", minWidth: 150 }}>
                    <div
                      style={{ fontSize: 15, fontWeight: 700, ...tnum }}
                      title={`${int(stats.views)} views`}
                    >
                      {vShort(stats.views)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 7,
                        marginTop: 5,
                      }}
                      title={`Chiếm ${share.toFixed(1).replace(".", ",")}% tổng views toàn hệ thống`}
                    >
                      <span
                        style={{
                          width: 72,
                          height: 5,
                          borderRadius: 3,
                          background: "var(--surface-2)",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            width: `${Math.min(100, share)}%`,
                            height: "100%",
                            background: "var(--accent)",
                          }}
                        />
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)", ...tnum }}>
                        {share.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                  </td>

                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {onOpenOwner && (
                      <button
                        onClick={() => onOpenOwner(owner.id)}
                        title={`Chuyển phạm vi dữ liệu sang ${owner.name || owner.email}`}
                        style={btnMini}
                      >
                        Mở dữ liệu
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: "10px 18px 13px",
          fontSize: 11.5,
          color: "var(--faint)",
          lineHeight: 1.6,
        }}
      >
        Số bài đăng và views lấy theo kỳ của báo cáo Karmar gần nhất đã nhập cho từng page. Ngách
        chỉ được tính là “đã triển khai” khi có ít nhất một page thuộc ngách đó.
      </div>
    </div>
  );
}
