"use client";

import { useMemo, useState } from "react";
import { int, mainNiche, pct, vShort } from "@/lib/format";
import { cardHint, cardTitle, tnum } from "@/lib/ui";
import { hotLevel } from "@/lib/rank";
import type { Niche, Page } from "@/lib/types";
import { Avatar, HotMeter, NicheDot, StatusBadge } from "./Atoms";

const LIMIT = 8;

type Tab = "top" | "watch";

/**
 * Hai mặt của cùng một danh sách page: đầu bảng và cuối bảng.
 *
 *  - "Nổi bật"    — page kéo nhiều views nhất, tức mẫu đáng nhân bản.
 *  - "Cần chú ý"  — page **không đăng bài nào trong kỳ** xếp trước, rồi tới page
 *                   có PPI thấp nhất. Page im lặng nguy hiểm hơn page yếu vì nó
 *                   không tạo dữ liệu mới, nên phải nằm trên cùng.
 *
 * Cả hai đều tính tại chỗ từ page đang hiển thị, nên tự đổi theo bộ lọc ngách.
 */
export default function PageSpotlight({
  pages,
  niches,
  onOpenPage,
}: {
  pages: Page[];
  niches: Niche[];
  onOpenPage: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("top");

  const top = useMemo(
    () => [...pages].sort((a, b) => b.views - a.views).slice(0, LIMIT),
    [pages],
  );

  const watch = useMemo(
    () =>
      [...pages]
        .sort((a, b) => {
          const silent = Number(a.posts === 0) - Number(b.posts === 0);
          // Page im lặng lên trước; cùng nhóm thì PPI thấp lên trước.
          if (silent !== 0) return -silent;
          return a.ppi - b.ppi;
        })
        .slice(0, LIMIT),
    [pages],
  );

  const list = tab === "top" ? top : watch;
  const silentCount = useMemo(() => pages.filter((p) => p.posts === 0).length, [pages]);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "15px 18px 12px",
        }}
      >
        <div style={cardTitle}>{tab === "top" ? "Page nổi bật" : "Page cần chú ý"}</div>
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            flex: "none",
          }}
        >
          {(
            [
              { id: "top" as Tab, label: "Nổi bật" },
              { id: "watch" as Tab, label: silentCount ? `Cần chú ý (${silentCount})` : "Cần chú ý" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "5px 11px",
                border: "none",
                cursor: "pointer",
                fontSize: 11.5,
                fontWeight: tab === t.id ? 600 : 500,
                background: tab === t.id ? "var(--accent)" : "transparent",
                color: tab === t.id ? "#fff" : "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...cardHint, padding: "0 18px 10px" }}>
        {tab === "top"
          ? `${LIMIT} page nhiều views nhất trong phạm vi đang xem`
          : "Page không đăng bài trong kỳ xếp trước, rồi tới PPI thấp nhất"}
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        {list.map((p) => {
          const nc = mainNiche(niches, p.nicheIds);
          const silent = p.posts === 0;

          return (
            <button
              key={p.id}
              onClick={() => onOpenPage(p.id)}
              className="row-hover"
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "26px minmax(0,1fr) auto",
                alignItems: "center",
                gap: 10,
                padding: "9px 18px",
                border: "none",
                borderBottom: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Avatar name={p.name} src={p.image} size={26} radius={7} fontSize={10} />

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginTop: 2,
                    fontSize: 11,
                    color: "var(--muted)",
                  }}
                >
                  <NicheDot color={nc.color} size={7} />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 120,
                    }}
                  >
                    {nc.name}
                  </span>
                  <span style={{ color: "var(--faint)" }}>·</span>
                  <span style={tnum}>{int(p.follower)} follower</span>
                </div>
              </div>

              <div style={{ textAlign: "right", flex: "none" }}>
                {tab === "top" ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, ...tnum }}>{vShort(p.views)}</div>
                    <div style={{ marginTop: 2 }}>
                      <HotMeter level={hotLevel(p.views)} size={10} />
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: silent ? "var(--danger)" : "var(--muted)",
                        ...tnum,
                      }}
                    >
                      {silent ? "0 bài trong kỳ" : `${int(p.posts)} bài · ${pct(p.rate)}`}
                    </div>
                    <div style={{ marginTop: 3 }}>
                      <StatusBadge ppi={p.ppi} />
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}

        {!list.length && (
          <div style={{ padding: "20px 18px", fontSize: 12.5, color: "var(--muted)" }}>
            Không có page nào trong phạm vi đang xem.
          </div>
        )}
      </div>
    </div>
  );
}
