"use client";

import { useState } from "react";
import { screenPad } from "@/lib/ui";
import type { AdminUser, Group, Niche, Owner, Page, Sub } from "@/lib/types";
import type { NicheMode } from "./CrmApp";
import type { NicheDraft } from "./NicheModal";
import ArrangePanel from "./ArrangePanel";
import ImportPanel from "./ImportPanel";
import ManageGroups from "./ManageGroups";
import ManageNiches from "./ManageNiches";
import ManagePages from "./ManagePages";
import ManageUsers from "./ManageUsers";

type Tab = "import" | "arrange" | "pages" | "groups" | "niches" | "users";

/** Bảng điều khiển người dùng — chỉ tài khoản tổng mới nhận prop này. */
export type UsersPanel = {
  list: AdminUser[];
  me: string | null;
  scopeUserId: string | null;
  defaultPassword: boolean;
  onCreate: (v: { email: string; password: string; name: string; role: string }) => void;
  onUpdate: (id: string, v: { name?: string; password?: string; role?: string }) => void;
  onDelete: (id: string) => void;
  onOpenScope: (id: string | null) => void;
};

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "import", label: "Nhập dữ liệu", hint: "Tải file .xlsx từ Karmar" },
  { id: "arrange", label: "Xếp nhóm theo file", hint: 'Theo cột "Nhóm" trong file, hoặc chia đều N page' },
  { id: "pages", label: "Gán page", hint: "Ngách & nhóm cho từng page" },
  { id: "groups", label: "Nhóm page", hint: "Tạo / sửa / xóa nhóm" },
  { id: "niches", label: "Ngách", hint: "Tạo / sửa / xóa ngách" },
  { id: "users", label: "Người dùng", hint: "Tài khoản và dữ liệu của từng người" },
];

/**
 * Màn quản lý dữ liệu: import .xlsx + gom nhóm theo file danh sách + CRUD ngách,
 * nhóm và gán page.
 */
export default function Manage({
  tab,
  onTab,
  niches,
  groups,
  subs,
  pages,
  onImported,
  onAssignNiches,
  onMovePage,
  onBulk,
  onDeletePage,
  onDeletePages,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onDeleteGroups,
  onCreateSub,
  onRenameSub,
  onDeleteSub,
  onOpenNicheModal,
  onDeleteNiche,
  owners,
  users,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  niches: Niche[];
  groups: Group[];
  subs: Sub[];
  pages: Page[];
  onImported: () => void;
  onAssignNiches: (pageId: string, nicheIds: string[]) => void;
  onMovePage: (pageId: string, groupId: string, subId: string) => void;
  onBulk: (
    ids: string[],
    change: { nicheIds?: string[]; nicheMode?: NicheMode; subId?: string },
  ) => void;
  onDeletePage: (pageId: string) => void;
  onDeletePages: (ids: string[]) => void;
  onCreateGroup: (name: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onDeleteGroups: (ids: string[], withPages: boolean) => void;
  onCreateSub: (groupId: string, name: string) => void;
  onRenameSub: (id: string, name: string) => void;
  onDeleteSub: (id: string) => void;
  onOpenNicheModal: (draft: NicheDraft) => void;
  onDeleteNiche: (id: string, moveTo: string | null) => void;
  /** Chủ sở hữu dữ liệu — chỉ khác rỗng khi tài khoản tổng xem gộp nhiều tài khoản. */
  owners: Owner[];
  users?: UsersPanel;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);

  return (
    <div className="crm-pop" style={screenPad}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
        }}
      >
        {TABS.filter((t) => t.id !== "users" || users).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              title={t.hint}
              style={{
                padding: "9px 15px",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 9,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "import" && (
        <ImportPanel niches={niches} groups={groups} subs={subs} onImported={onImported} />
      )}

      {tab === "arrange" && <ArrangePanel niches={niches} onArranged={onImported} />}

      {tab === "pages" && (
        <ManagePages
          pages={pages}
          niches={niches}
          groups={groups}
          subs={subs}
          owners={owners}
          onAssignNiches={onAssignNiches}
          onMovePage={onMovePage}
          onBulk={onBulk}
          onDeletePages={onDeletePages}
          onDeletePage={(id) => {
            // Xóa page là thao tác không hoàn tác — bấm lần 2 để xác nhận.
            if (confirm === id) {
              onDeletePage(id);
              setConfirm(null);
            } else {
              setConfirm(id);
              window.setTimeout(() => setConfirm((c) => (c === id ? null : c)), 4000);
            }
          }}
        />
      )}

      {tab === "pages" && confirm && (
        <div
          style={{
            marginTop: 10,
            padding: "9px 12px",
            borderRadius: 8,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 12.5,
          }}
        >
          Bấm “Xóa” lần nữa ở dòng đó để xác nhận xóa page khỏi hệ thống.
        </div>
      )}

      {tab === "groups" && (
        <ManageGroups
          groups={groups}
          subs={subs}
          pages={pages}
          onCreateGroup={onCreateGroup}
          onRenameGroup={onRenameGroup}
          onDeleteGroup={onDeleteGroup}
          onDeleteGroups={onDeleteGroups}
          onCreateSub={onCreateSub}
          onRenameSub={onRenameSub}
          onDeleteSub={onDeleteSub}
        />
      )}

      {tab === "users" && users && (
        <ManageUsers
          users={users.list}
          me={users.me}
          scopeUserId={users.scopeUserId}
          defaultPassword={users.defaultPassword}
          onCreate={users.onCreate}
          onUpdate={users.onUpdate}
          onDelete={users.onDelete}
          onOpenScope={users.onOpenScope}
        />
      )}

      {tab === "niches" && (
        <ManageNiches
          niches={niches}
          pages={pages}
          onOpenModal={onOpenNicheModal}
          onDelete={onDeleteNiche}
        />
      )}
    </div>
  );
}

export type { Tab as ManageTab };
