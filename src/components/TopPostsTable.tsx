"use client";

import { useMemo, useState } from "react";
import { int, negStyle, nicheById, pct } from "@/lib/format";
import { thBase, tnum } from "@/lib/ui";
import type { Niche, SortState, TopPost } from "@/lib/types";
import { NicheDot, PostCaption, PostThumb, isVideoPost } from "./Atoms";

type Col = "likes" | "comments" | "rcs" | "rate" | "neg";

const COLS: { key: Col; label: string; padRight?: boolean }[] = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Bình luận" },
  { key: "rcs", label: "R/C/S" },
  { key: "rate", label: "Tương tác" },
  { key: "neg", label: "Neg. sentiment", padRight: true },
];

/** Bảng Top post — header sticky, mọi cột số sort được. */
export default function TopPostsTable({
  posts,
  niches,
  negThreshold,
}: {
  posts: TopPost[];
  niches: Niche[];
  negThreshold: number;
}) {
  const [sort, setSort] = useState<SortState>({ col: "rate", dir: "desc" });

  const rows = useMemo(() => {
    const list = [...posts];
    if (sort) {
      const key = sort.col as Col;
      list.sort((a, b) => (sort.dir === "desc" ? b[key] - a[key] : a[key] - b[key]));
    }
    return list;
  }, [posts, sort]);

  function toggle(col: Col) {
    setSort((cur) =>
      cur && cur.col === col
        ? { col, dir: cur.dir === "desc" ? "asc" : "desc" }
        : { col, dir: "desc" },
    );
  }

  const indicator = (col: Col) =>
    sort && sort.col === col ? (sort.dir === "desc" ? " ↓" : " ↑") : "";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "15px 18px 12px", fontSize: 14, fontWeight: 600 }}>
        Top video / post
      </div>

      <div className="crm-scroll" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th
                style={{
                  ...thBase,
                  textAlign: "left",
                  padding: "9px 14px",
                  position: "sticky",
                  top: 0,
                }}
              >
                Bài đăng
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  style={{
                    ...thBase,
                    padding: c.padRight ? "9px 14px" : "9px 10px",
                    cursor: "pointer",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  {c.label}
                  {indicator(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const nc = nicheById(niches, p.nicheId);
              return (
                <tr
                  key={p.id}
                  className="row-hover"
                  style={{ borderBottom: "1px solid var(--border)", transition: "background .1s" }}
                >
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <PostThumb
                        src={p.image}
                        seed={p.caption}
                        size={56}
                        video={isVideoPost(p.link)}
                      />
                      <div style={{ minWidth: 0 }}>
                        <PostCaption caption={p.caption} link={p.link} maxWidth={300} />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginTop: 3,
                            fontSize: 11,
                            color: "var(--muted)",
                          }}
                        >
                          <span>{p.pageName}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <NicheDot color={nc.color} />
                            {nc.name}
                          </span>
                          <span>· {p.time}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", padding: "9px 10px", ...tnum }}>
                    {int(p.likes)}
                  </td>
                  <td style={{ textAlign: "right", padding: "9px 10px", ...tnum }}>
                    {int(p.comments)}
                  </td>
                  <td style={{ textAlign: "right", padding: "9px 10px", ...tnum }}>{int(p.rcs)}</td>
                  <td
                    style={{ textAlign: "right", padding: "9px 10px", fontWeight: 600, ...tnum }}
                  >
                    {pct(p.rate)}
                  </td>
                  <td style={{ textAlign: "right", padding: "9px 14px" }}>
                    <span style={negStyle(p.neg, negThreshold, true)}>{pct(p.neg)}</span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ padding: "18px 14px", color: "var(--muted)", fontSize: 12.5 }}
                >
                  Không có bài đăng nào trong ngách đang lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
