"use client";

import { btnGhost, btnPrimary } from "@/lib/ui";
import type { Page } from "@/lib/types";
import { Avatar } from "./Atoms";

/** Yêu cầu chuyển nhóm/sub đang chờ xác nhận — chưa đụng tới dữ liệu. */
export type MoveAsk = {
  page: Page;
  /** Đổi ở cột nào — chỉ dùng để đặt tiêu đề cho đúng. */
  kind: "group" | "sub";
  /** Nhóm/sub đích sẽ ghi xuống khi người dùng bấm xác nhận. */
  groupId: string;
  subId: string;
  fromGroup: string;
  fromSub: string;
  toGroup: string;
  toSub: string;
};

/**
 * Chốt lại một lần trước khi chuyển page sang nhóm/sub khác: dropdown đổi ngay
 * quá dễ bấm nhầm, mà chuyển sai thì phải dò lại xem page nằm ở đâu.
 */
export default function MoveConfirm({
  ask,
  onCancel,
  onConfirm,
}: {
  ask: MoveAsk;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(15,18,25,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="crm-pop-fast"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15,18,25,.28)",
        }}
      >
        <div style={{ padding: "18px 20px 14px" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {ask.kind === "group" ? "Xác nhận chuyển nhóm" : "Xác nhận chuyển sub-group"}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginTop: 14,
              minWidth: 0,
            }}
          >
            <Avatar name={ask.page.name} src={ask.page.image} size={28} radius={7} fontSize={11} />
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={ask.page.name}
            >
              {ask.page.name}
            </span>
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--border)",
              borderRadius: 9,
              overflow: "hidden",
              fontSize: 12.5,
            }}
          >
            <Line label="Đang ở" group={ask.fromGroup} sub={ask.fromSub} />
            <Line label="Chuyển sang" group={ask.toGroup} sub={ask.toSub} strong />
          </div>

          {ask.kind === "group" && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--faint)" }}>
              Đổi nhóm sẽ đưa page về sub-group đầu tiên của nhóm mới.
            </div>
          )}
        </div>

        <div
          style={{
            padding: "13px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button onClick={onCancel} style={{ ...btnGhost, height: 36, fontSize: 13 }}>
            Hủy thao tác
          </button>
          <button onClick={onConfirm} style={{ ...btnPrimary, height: 36, fontSize: 13 }} autoFocus>
            Xác nhận chuyển
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  group,
  sub,
  strong,
}: {
  label: string;
  group: string;
  sub: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderTop: strong ? "1px solid var(--border)" : undefined,
        background: strong ? "var(--surface)" : "transparent",
      }}
    >
      <span style={{ width: 84, color: "var(--muted)", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontWeight: strong ? 600 : 500,
          color: strong ? "var(--text)" : "var(--muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={`${group} / ${sub}`}
      >
        {group} <span style={{ color: "var(--faint)", fontWeight: 400 }}>/</span> {sub}
      </span>
    </div>
  );
}
