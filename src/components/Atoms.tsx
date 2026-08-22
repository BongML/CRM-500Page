"use client";

import { useState, type CSSProperties } from "react";
import { avatarBg, initials as initialsOf, statusOf, statusStyle, tint } from "@/lib/format";
import { tnum } from "@/lib/ui";
import { hotColor, hotMeta, rankMeta, type HotLevel, type Rank } from "@/lib/rank";
import type { Niche } from "@/lib/types";

/** Ô vuông màu ngách (dot vuông bo nhẹ) dùng trong tag, legend, chú thích. */
export function NicheDot({
  color,
  size = 8,
  radius = 2,
}: {
  color: string;
  size?: number;
  radius?: number;
}) {
  return (
    <span
      style={{ width: size, height: size, borderRadius: radius, background: color, flex: "none" }}
    />
  );
}

/** Tag ngách pill: dot + tên, nền tint 11%. */
export function NicheTag({ niche, size = 11 }: { niche: Niche; size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 20,
        background: tint(niche.color),
        color: niche.color,
        fontSize: size,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <NicheDot color={niche.color} size={7} />
      {niche.name}
    </span>
  );
}

/** Badge trạng thái tính từ PPI. */
export function StatusBadge({ ppi }: { ppi: number }) {
  return <span style={statusStyle(ppi)}>{statusOf(ppi).label}</span>;
}

/** Avatar page: nền HSL sinh từ tên + initials. */
/**
 * Ảnh đại diện page. Có `src` (cột "Image Link" của báo cáo) thì dùng ảnh thật;
 * không có — hoặc ảnh chết — thì quay về chữ cái đầu trên nền màu.
 *
 * Bắt buộc phải có đường lùi: link fbcdn kèm chữ ký hết hạn sau vài ngày, nên
 * sớm muộn gì ảnh cũng hỏng cho tới lần nhập báo cáo tiếp theo. Dùng thẻ <img>
 * thay next/image vì host ảnh thay đổi liên tục, không khai báo trước được.
 */
export function Avatar({
  name,
  src,
  size,
  radius,
  fontSize,
}: {
  name: string;
  src?: string | null;
  size: number;
  radius: number;
  fontSize: number;
}) {
  const [broken, setBroken] = useState(false);
  const box: CSSProperties = {
    width: size,
    height: size,
    flex: "none",
    borderRadius: radius,
  };

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ ...box, objectFit: "cover", background: "var(--surface-2)" }}
      />
    );
  }

  return (
    <div
      style={{
        ...box,
        background: avatarBg(name),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 600,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

/**
 * Nhãn tăng/giảm so với kỳ báo cáo liền trước.
 *
 * `good` cho biết chiều nào là tốt: với views/reach thì tăng là tốt, nhưng nếu
 * sau này cần theo dõi một chỉ số mà giảm mới là tốt thì đảo cờ này, không phải
 * sửa màu ở chỗ gọi.
 */
export function DeltaTag({
  pct,
  title,
  higherIsBetter = true,
}: {
  pct: number;
  title?: string;
  higherIsBetter?: boolean;
}) {
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const positive = higherIsBetter ? up : !up;
  const color = flat ? "var(--muted)" : positive ? "var(--good)" : "var(--danger)";

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        color,
        background: flat ? "var(--surface-2)" : positive ? "rgba(22,163,74,.12)" : "var(--danger-soft)",
        ...tnum,
      }}
    >
      {flat ? "•" : up ? "▲" : "▼"}
      {Math.abs(pct).toFixed(1).replace(".", ",")}%
    </span>
  );
}

/**
 * Thẻ KPI lớn của dashboard. `delta` chỉ có mặt với chỉ số được chốt vào
 * Snapshot qua từng kỳ — chỉ số nào chưa có lịch sử thì để trống chứ không bịa
 * ra mức tăng.
 */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  higherIsBetter,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: { pct: number; prevLabel: string } | null;
  higherIsBetter?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: "16px 17px",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "-.5px",
            marginTop: 7,
            ...tnum,
          }}
        >
          {value}
        </div>
        {delta && (
          <DeltaTag
            pct={delta.pct}
            higherIsBetter={higherIsBetter}
            title={`So với kỳ báo cáo ${delta.prevLabel}`}
          />
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>
        {delta ? `so kỳ ${delta.prevLabel} · ${sub}` : sub}
      </div>
    </div>
  );
}

/**
 * Thanh phân bổ ngang: mỗi đoạn là một bậc, bề rộng theo tỉ trọng. Dùng cho
 * "sức khỏe hệ thống page" — nhìn một phát ra ngay tỉ lệ page cần review so với
 * page hiệu quả, thứ mà đọc 3 con số rời rạc không thấy được.
 */
export function StackBar({
  parts,
  height = 10,
}: {
  parts: { key: string; label: string; color: string; count: number }[];
  height?: number;
}) {
  const total = parts.reduce((s, p) => s + p.count, 0);

  return (
    <div
      style={{
        display: "flex",
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        background: "var(--surface-2)",
      }}
    >
      {total > 0 &&
        parts
          .filter((p) => p.count > 0)
          .map((p) => (
            <div
              key={p.key}
              title={`${p.label}: ${p.count} page (${Math.round((p.count / total) * 100)}%)`}
              style={{ width: `${(p.count / total) * 100}%`, background: p.color }}
            />
          ))}
    </div>
  );
}

/** KPI nhỏ ở trang chi tiết page (grid 4×2). */
export function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: "13px 15px",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 5, ...tnum }}>{value}</div>
    </div>
  );
}

/**
 * Caption của bài đăng. Báo cáo top content có cột Link nên caption mở thẳng
 * bài gốc; báo cáo thiếu link thì chỉ hiển thị chữ.
 */
export function PostCaption({
  caption,
  link,
  maxWidth,
}: {
  caption: string;
  link: string | null;
  maxWidth: number;
}) {
  const style: CSSProperties = {
    display: "block",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth,
    color: "inherit",
  };

  if (!link) return <span style={style}>{caption}</span>;

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer noopener"
      title={caption}
      style={{ ...style, textDecoration: "none" }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
    >
      {caption}
    </a>
  );
}

/**
 * Thanh độ hot: vẽ đúng bằng số ⚡ của bậc, không có ô mờ chèn thêm (5⚡ hot
 * nhất, 1⚡ yếu nhất). Xem cách chia ở lib/rank.ts.
 */
export function HotMeter({ level, size = 12 }: { level: HotLevel; size?: number }) {
  const { label, note } = hotMeta(level);
  const color = hotColor(level);

  return (
    <span
      title={`${level}/5 ⚡ — ${label}: ${note}`}
      aria-label={`Độ hot ${level} trên 5 — ${label}`}
      style={{ display: "inline-flex", gap: 1, lineHeight: 1, whiteSpace: "nowrap" }}
    >
      {Array.from({ length: level }, (_, i) => (
        <span key={i} aria-hidden style={{ fontSize: size, color }}>
          ⚡
        </span>
      ))}
    </span>
  );
}

/** Huy hiệu hạng quy mô follower: S cao nhất → F thấp nhất. */
export function RankBadge({ rank, size = 11 }: { rank: Rank; size?: number }) {
  const { color, label } = rankMeta(rank);

  return (
    <span
      title={`Hạng ${rank} — ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size + 11,
        padding: "2px 6px",
        borderRadius: 5,
        border: `1px solid ${color}66`,
        background: tint(color),
        color,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.5,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {rank}
    </span>
  );
}

/** Link bài là reel/video → hiện huy hiệu play trên thumbnail. */
export function isVideoPost(link: string | null): boolean {
  return !!link && /\/(reel|reels|videos?|watch)\//i.test(link);
}

/**
 * Thumbnail bài đăng: dùng ảnh thật ở cột "Image Link" của báo cáo top content.
 * Link ảnh fbcdn có hạn dùng vài ngày, nên khi ảnh chết thì rơi về ô màu sinh từ
 * caption thay vì để khung vỡ — nhập lại báo cáo là có link mới.
 */
export function PostThumb({
  src,
  seed,
  size,
  video,
}: {
  src: string | null;
  seed: string;
  size: number;
  video?: boolean;
}) {
  // Lưu đúng URL đã hỏng, để lần nhập sau đổi link là thử lại chứ không tắt luôn.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const showImage = !!src && brokenSrc !== src;

  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: 7,
        overflow: "hidden",
        position: "relative",
        background: showImage ? "var(--surface-2)" : avatarBg(seed),
      }}
    >
      {showImage && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          // Không lộ URL nội bộ ra CDN của Facebook.
          referrerPolicy="no-referrer"
          onError={() => setBrokenSrc(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}

      {video && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: Math.round(size * 0.42),
              height: Math.round(size * 0.42),
              borderRadius: "50%",
              background: "rgba(0,0,0,.5)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: Math.round(size * 0.2),
              lineHeight: 1,
              paddingLeft: Math.max(1, Math.round(size * 0.03)),
            }}
          >
            ▶
          </span>
        </span>
      )}
    </div>
  );
}
