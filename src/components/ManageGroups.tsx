"use client";

import { useState } from "react";
import { btnGhost, btnMini, btnPrimary, cardHint, cardTitle, inputMini } from "@/lib/ui";
import type { Group, Page, Sub } from "@/lib/types";

const GROUP_CAP = 25;

type Editing = { id: string; kind: "group" | "sub"; value: string } | null;

/** Ô tên: bấm "Đổi tên" thì thành input, Enter để lưu, Esc để hủy. */
function NameCell({
  id,
  kind,
  name,
  bold,
  editing,
  onChange,
  onCommit,
  onCancel,
}: {
  id: string;
  kind: "group" | "sub";
  name: string;
  bold?: boolean;
  editing: Editing;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  if (editing?.id !== id || editing.kind !== kind) {
    return <span style={{ fontSize: bold ? 13.5 : 13, fontWeight: bold ? 600 : 500 }}>{name}</span>;
  }
  return (
    <input
      autoFocus
      value={editing.value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      style={{ ...inputMini, width: 220 }}
    />
  );
}

/** CRUD nhóm page & sub-group: tạo, đổi tên, xóa (chỉ xóa được khi rỗng). */
export default function ManageGroups({
  groups,
  subs,
  pages,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onDeleteGroups,
  onCreateSub,
  onRenameSub,
  onDeleteSub,
}: {
  groups: Group[];
  subs: Sub[];
  pages: Page[];
  onCreateGroup: (name: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onDeleteGroups: (ids: string[], withPages: boolean) => void;
  onCreateSub: (groupId: string, name: string) => void;
  onRenameSub: (id: string, name: string) => void;
  onDeleteSub: (id: string) => void;
}) {
  const [newGroup, setNewGroup] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  /** Xóa nhóm kèm page không hoàn tác được — lần bấm đầu chỉ chuyển sang hỏi lại. */
  const [ask, setAsk] = useState(false);

  const pagesInGroup = (id: string) => pages.filter((p) => p.groupId === id).length;

  const pickedIds = groups.filter((g) => picked[g.id]).map((g) => g.id);
  const allPicked = groups.length > 0 && pickedIds.length === groups.length;
  /** Số page sẽ mất theo nếu xóa đúng các nhóm đang tick. */
  const pagesAtRisk = pages.filter((p) => picked[p.groupId]).length;
  const pagesInSub = (id: string) => pages.filter((p) => p.subId === id).length;

  function commit() {
    if (!editing) return;
    const name = editing.value.trim();
    if (name) {
      if (editing.kind === "group") onRenameGroup(editing.id, name);
      else onRenameSub(editing.id, name);
    }
    setEditing(null);
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: "16px 18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={cardTitle}>Nhóm page & sub-group</div>
        <div style={cardHint}>
          Mỗi nhóm tối đa {GROUP_CAP} page · tick để xóa nhiều nhóm cùng lúc
        </div>
      </div>

      {groups.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => {
                setAsk(false);
                setPicked(allPicked ? {} : Object.fromEntries(groups.map((g) => [g.id, true])));
              }}
              style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }}
            />
            Chọn tất cả {groups.length} nhóm
          </label>

          {pickedIds.length > 0 && (
            <>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {pickedIds.length} nhóm đã chọn
                {pagesAtRisk > 0 ? ` · chứa ${pagesAtRisk} page` : " · đều rỗng"}
              </span>

              <button
                onClick={() => {
                  if (!ask) {
                    setAsk(true);
                    window.setTimeout(() => setAsk(false), 6000);
                    return;
                  }
                  onDeleteGroups(pickedIds, pagesAtRisk > 0);
                  setPicked({});
                  setAsk(false);
                }}
                title={
                  pagesAtRisk > 0
                    ? "Xóa các nhóm đã chọn cùng toàn bộ page bên trong"
                    : "Xóa các nhóm rỗng đã chọn"
                }
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${ask ? "var(--danger)" : "var(--border-strong)"}`,
                  background: ask ? "var(--danger)" : "transparent",
                  color: ask ? "#fff" : "var(--danger)",
                }}
              >
                {ask
                  ? pagesAtRisk > 0
                    ? `Bấm lần nữa: xóa ${pickedIds.length} nhóm và ${pagesAtRisk} page`
                    : `Bấm lần nữa để xóa ${pickedIds.length} nhóm`
                  : pagesAtRisk > 0
                    ? `Xóa ${pickedIds.length} nhóm + ${pagesAtRisk} page`
                    : `Xóa ${pickedIds.length} nhóm`}
              </button>

              <button
                onClick={() => {
                  setPicked({});
                  setAsk(false);
                }}
                style={{ ...btnGhost, height: 32, fontSize: 12.5 }}
              >
                Bỏ chọn
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newGroup.trim()) {
              onCreateGroup(newGroup.trim());
              setNewGroup("");
            }
          }}
          placeholder="Tên nhóm mới, VD: Nhóm 04"
          style={{ ...inputMini, height: 38, flex: 1, maxWidth: 320 }}
        />
        <button
          onClick={() => {
            onCreateGroup(newGroup.trim());
            setNewGroup("");
          }}
          style={btnPrimary}
        >
          + Tạo nhóm
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groups.map((g) => {
          const count = pagesInGroup(g.id);
          const full = count >= GROUP_CAP;
          return (
            <div key={g.id} style={{ border: "1px solid var(--border)", borderRadius: 9 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!picked[g.id]}
                  onChange={() => {
                    setAsk(false);
                    setPicked((prev) => ({ ...prev, [g.id]: !prev[g.id] }));
                  }}
                  aria-label={`Chọn ${g.name}`}
                  style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <NameCell
                  id={g.id}
                  kind="group"
                  name={g.name}
                  bold
                  editing={editing}
                  onChange={(value) => setEditing((e) => (e ? { ...e, value } : e))}
                  onCommit={commit}
                  onCancel={() => setEditing(null)}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 20,
                    color: full ? "var(--warn)" : "var(--muted)",
                    background: full ? "rgba(217,119,6,.14)" : "var(--accent-soft)",
                  }}
                >
                  {count}/{GROUP_CAP} page
                </span>

                <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                  <button
                    onClick={() => setEditing({ id: g.id, kind: "group", value: g.name })}
                    style={btnMini}
                  >
                    Đổi tên
                  </button>
                  <button onClick={() => onCreateSub(g.id, "")} style={btnMini}>
                    + Sub-group
                  </button>
                  <button
                    onClick={() => onDeleteGroup(g.id)}
                    disabled={count > 0}
                    title={count > 0 ? "Chuyển hết page đi rồi mới xóa được" : "Xóa nhóm"}
                    style={{
                      ...btnMini,
                      color: count > 0 ? "var(--faint)" : "var(--danger)",
                      cursor: count > 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </div>

              {subs
                .filter((s) => s.groupId === g.id)
                .map((s) => {
                  const sc = pagesInSub(s.id);
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px 8px 26px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ color: "var(--faint)", fontSize: 12 }}>└</span>
                      <NameCell
                        id={s.id}
                        kind="sub"
                        name={s.name}
                        editing={editing}
                        onChange={(value) => setEditing((e) => (e ? { ...e, value } : e))}
                        onCommit={commit}
                        onCancel={() => setEditing(null)}
                      />
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{sc} page</span>

                      <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                        <button
                          onClick={() => setEditing({ id: s.id, kind: "sub", value: s.name })}
                          style={btnMini}
                        >
                          Đổi tên
                        </button>
                        <button
                          onClick={() => onDeleteSub(s.id)}
                          disabled={sc > 0}
                          title={sc > 0 ? "Chuyển hết page đi rồi mới xóa được" : "Xóa sub-group"}
                          style={{
                            ...btnMini,
                            color: sc > 0 ? "var(--faint)" : "var(--danger)",
                            cursor: sc > 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  );
                })}

              {subs.every((s) => s.groupId !== g.id) && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted)" }}>
                  Chưa có sub-group nào.{" "}
                  <button
                    onClick={() => onCreateSub(g.id, "")}
                    style={{ ...btnGhost, height: 26, padding: "0 10px", fontSize: 12 }}
                  >
                    Tạo sub-group
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Chưa có nhóm nào — tạo nhóm đầu tiên ở trên.
          </div>
        )}
      </div>
    </div>
  );
}
