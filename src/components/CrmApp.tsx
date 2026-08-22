"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/useTheme";
import { hotLevel } from "@/lib/rank";
import type {
  AdminUser,
  Bootstrap,
  Group,
  Niche,
  Owner,
  Page,
  Screen,
  Snapshot,
  Sub,
  TopPost,
  Trend,
  SessionUser,
} from "@/lib/types";
import LoginScreen from "./LoginScreen";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Dashboard from "./Dashboard";
import Catalog from "./Catalog";
import PageDetail from "./PageDetail";
import BulkBar from "./BulkBar";
import NicheModal, { type NicheDraft } from "./NicheModal";
import Manage, { type ManageTab } from "./Manage";

const TITLES: Record<Screen, string> = {
  login: "",
  dashboard: "Dashboard tổng thể",
  catalog: "Danh mục ngách & nhóm page",
  page: "Chi tiết fanpage",
  manage: "Quản lý dữ liệu",
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Lỗi ${res.status}`);
  return json;
}

export default function CrmApp({ initial }: { initial: Bootstrap }) {
  const [theme, toggleTheme] = useTheme();

  const [niches, setNiches] = useState<Niche[]>(initial.niches);
  const [pages, setPages] = useState<Page[]>(initial.pages);
  const [groups, setGroups] = useState<Group[]>(initial.groups);
  const [subs, setSubs] = useState<Sub[]>(initial.subs);
  const [topPosts, setTopPosts] = useState<TopPost[]>(initial.topPosts);
  const [trends, setTrends] = useState<Trend[]>(initial.trends);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initial.snapshots);

  const [owners, setOwners] = useState<Owner[]>(initial.owners);

  const [user, setUser] = useState<SessionUser | null>(null);
  // Tài khoản tổng: danh sách người dùng + phạm vi dữ liệu đang xem
  // (null = gộp toàn hệ thống).
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [scopeUserId, setScopeUserId] = useState<string | null>(initial.scope.userId);
  const [defaultPassword, setDefaultPassword] = useState(false);
  const [screen, setScreen] = useState<Screen>("login");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [nicheFilter, setNicheFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<NicheDraft | null>(null);
  const [manageTab, setManageTab] = useState<ManageTab>("import");
  const [error, setError] = useState<string | null>(null);

  /** Danh sách tài khoản cho ô chọn phạm vi + tab Người dùng (chỉ admin gọi được). */
  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (!res.ok) return;
    const data: { users: AdminUser[]; defaultPassword: boolean } = await res.json();
    setAccounts(data.users);
    setDefaultPassword(data.defaultPassword);
  }, []);

  // Còn phiên đăng nhập thì vào thẳng dashboard.
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then(
        (s: {
          authed: boolean;
          user: SessionUser | null;
          scope: { admin: boolean; userId: string | null } | null;
        }) => {
          if (!s.authed || !s.user) return;
          setUser(s.user);
          setScopeUserId(s.scope?.userId ?? null);
          setScreen("dashboard");
          if (s.user.role === "admin") loadAccounts().catch(() => undefined);
        },
      )
      .catch(() => undefined);
  }, [loadAccounts]);

  /** Nạp lại toàn bộ dữ liệu (dùng sau khi nhập .xlsx). */
  const refresh = useCallback(async () => {
    const data: Bootstrap = await fetch("/api/bootstrap").then((r) => r.json());
    setNiches(data.niches);
    setPages(data.pages);
    setGroups(data.groups);
    setSubs(data.subs);
    setTopPosts(data.topPosts);
    setTrends(data.trends);
    setSnapshots(data.snapshots);
    setOwners(data.owners ?? []);
    setScopeUserId(data.scope?.userId ?? null);
  }, []);

  const fail = useCallback((e: unknown) => {
    console.error(e);
    setError(
      e instanceof Error && e.message
        ? e.message
        : "Không lưu được thay đổi lên máy chủ. Tải lại trang để đồng bộ.",
    );
    window.setTimeout(() => setError(null), 6000);
  }, []);

  /** Page hiển thị theo 2 filter của topbar. */
  const visiblePages = useMemo(
    () =>
      pages.filter(
        (p) =>
          (nicheFilter ? p.nicheId === nicheFilter : true) &&
          (groupFilter === "all" ? true : p.groupId === groupFilter),
      ),
    [pages, nicheFilter, groupFilter],
  );

  const visibleGroups = useMemo(
    () => groups.filter((g) => groupFilter === "all" || g.id === groupFilter),
    [groups, groupFilter],
  );

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
  );

  const detailPage = selectedPageId ? pages.find((p) => p.id === selectedPageId) : undefined;

  // ---- mutations (cập nhật lạc quan + ghi xuống API) ----

  const changeNiche = useCallback(
    (pageId: string, nicheId: string) => {
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, nicheId } : p)));
      api(`/api/pages/${pageId}`, "PATCH", { nicheId }).catch(fail);
    },
    [fail],
  );

  const movePage = useCallback(
    (pageId: string, groupId: string, subId: string) => {
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, groupId, subId } : p)));
      api(`/api/pages/${pageId}`, "PATCH", { groupId, subId }).catch(fail);
    },
    [fail],
  );

  const bulkAssign = useCallback(
    (nicheId: string) => {
      const ids = selectedIds;
      if (!ids.length) return;
      setPages((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, nicheId } : p)));
      setSelected({});
      api("/api/pages/bulk", "POST", { ids, nicheId }).catch(fail);
    },
    [selectedIds, fail],
  );

  /** Gán ngách / chuyển nhóm cho nhiều page từ màn quản lý. */
  const bulkChange = useCallback(
    (ids: string[], change: { nicheId?: string; subId?: string }) => {
      if (!ids.length) return;
      const sub = change.subId ? subs.find((x) => x.id === change.subId) : undefined;

      setPages((prev) =>
        prev.map((p) =>
          ids.includes(p.id)
            ? {
                ...p,
                ...(change.nicheId ? { nicheId: change.nicheId } : {}),
                ...(sub ? { groupId: sub.groupId, subId: sub.id } : {}),
              }
            : p,
        ),
      );

      api("/api/pages/bulk", "POST", {
        ids,
        ...(change.nicheId ? { nicheId: change.nicheId } : {}),
        ...(sub ? { groupId: sub.groupId, subId: sub.id } : {}),
      }).catch((e) => {
        fail(e);
        refresh().catch(() => undefined);
      });
    },
    [subs, fail, refresh],
  );

  const deletePage = useCallback(
    (pageId: string) => {
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      // Bài của page cũng bị xóa ở server — bỏ khỏi state để UI không trỏ vào khoảng không.
      setTopPosts((prev) => prev.filter((t) => t.pageId !== pageId));
      setSelectedPageId((cur) => (cur === pageId ? null : cur));
      api(`/api/pages/${pageId}`, "DELETE").catch((e) => {
        fail(e);
        refresh().catch(() => undefined);
      });
    },
    [fail, refresh],
  );

  /** Xóa hẳn nhiều page đã tick. Không hoàn tác được — UI phải hỏi lại trước khi gọi. */
  const deletePages = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const gone = new Set(ids);

      setPages((prev) => prev.filter((p) => !gone.has(p.id)));
      setTopPosts((prev) => prev.filter((t) => !t.pageId || !gone.has(t.pageId)));
      setSelected({});
      setSelectedPageId((cur) => (cur && gone.has(cur) ? null : cur));

      api("/api/pages/bulk", "DELETE", { ids })
        // Số tổng hợp của ngách được tính lại ở server, nên phải nạp lại mới khớp.
        .then(() => refresh())
        .catch((e) => {
          fail(e);
          refresh().catch(() => undefined);
        });
    },
    [fail, refresh],
  );

  /**
   * Xóa nhiều nhóm cùng lúc. `withPages` bật thì page bên trong bị xóa theo —
   * server từ chối (409) nếu nhóm còn page mà chưa bật cờ này, nên giao diện luôn
   * có cơ hội hỏi lại bằng con số cụ thể.
   */
  const deleteGroups = useCallback(
    async (ids: string[], withPages: boolean) => {
      if (!ids.length) return;
      try {
        await api("/api/groups/bulk", "DELETE", { ids, withPages });
        await refresh();
      } catch (e) {
        fail(e);
        refresh().catch(() => undefined);
      }
    },
    [fail, refresh],
  );

  // ---- CRUD nhóm / sub-group / ngách (ghi server xong mới đồng bộ lại state) ----

  const createGroup = useCallback(
    async (name: string) => {
      try {
        const g: Group & { subs: Sub[] } = await api("/api/groups", "POST", { name });
        setGroups((prev) => [...prev, { id: g.id, name: g.name, order: g.order }]);
        setSubs((prev) => [...prev, ...g.subs.map((x) => ({ ...x, groupId: g.id }))]);
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  const renameGroup = useCallback(
    (id: string, name: string) => {
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
      api(`/api/groups/${id}`, "PATCH", { name }).catch(fail);
    },
    [fail],
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      try {
        await api(`/api/groups/${id}`, "DELETE");
        setGroups((prev) => prev.filter((g) => g.id !== id));
        setSubs((prev) => prev.filter((s) => s.groupId !== id));
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  const createSub = useCallback(
    async (groupId: string, name: string) => {
      try {
        const sub: Sub = await api("/api/subs", "POST", { groupId, name });
        setSubs((prev) => [...prev, sub]);
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  const renameSub = useCallback(
    (id: string, name: string) => {
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
      api(`/api/subs/${id}`, "PATCH", { name }).catch(fail);
    },
    [fail],
  );

  const deleteSub = useCallback(
    async (id: string) => {
      try {
        await api(`/api/subs/${id}`, "DELETE");
        setSubs((prev) => prev.filter((s) => s.id !== id));
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  const deleteNiche = useCallback(
    async (id: string, moveTo: string | null) => {
      try {
        await api(`/api/niches/${id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ""}`, "DELETE");
        await refresh();
        setNicheFilter((cur) => (cur === id ? null : cur));
      } catch (e) {
        fail(e);
      }
    },
    [fail, refresh],
  );

  const saveNiche = useCallback(
    async (v: { id: string | null; name: string; color: string; pageIds: string[] }) => {
      setModal(null);
      try {
        if (v.id) {
          const updated: Niche = await api(`/api/niches/${v.id}`, "PATCH", {
            name: v.name,
            color: v.color,
            pageIds: v.pageIds,
          });
          setNiches((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
          setPages((prev) =>
            prev.map((p) => (v.pageIds.includes(p.id) ? { ...p, nicheId: updated.id } : p)),
          );
        } else {
          const created: Niche = await api("/api/niches", "POST", {
            name: v.name,
            color: v.color,
            pageIds: v.pageIds,
          });
          setNiches((prev) => [...prev, created]);
          setPages((prev) =>
            prev.map((p) => (v.pageIds.includes(p.id) ? { ...p, nicheId: created.id } : p)),
          );
        }
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  // ---- tài khoản tổng: phạm vi dữ liệu + quản lý người dùng ----

  /**
   * Đổi phạm vi dữ liệu: null = gộp toàn hệ thống, hoặc bước vào không gian của
   * một tài khoản. Bộ lọc và ô đang chọn bị xóa vì chúng trỏ tới id của phạm vi cũ.
   */
  const changeScope = useCallback(
    async (id: string | null) => {
      try {
        await api("/api/admin/scope", "POST", { userId: id });
        setScopeUserId(id);
        setSelected({});
        setSelectedPageId(null);
        setNicheFilter(null);
        setGroupFilter("all");
        await refresh();
      } catch (e) {
        fail(e);
      }
    },
    [fail, refresh],
  );

  const createAccount = useCallback(
    async (v: { email: string; password: string; name: string; role: string }) => {
      try {
        await api("/api/admin/users", "POST", v);
        await loadAccounts();
      } catch (e) {
        fail(e);
      }
    },
    [fail, loadAccounts],
  );

  const updateAccount = useCallback(
    async (id: string, v: { name?: string; password?: string; role?: string }) => {
      try {
        await api(`/api/admin/users/${id}`, "PATCH", v);
        await loadAccounts();
      } catch (e) {
        fail(e);
      }
    },
    [fail, loadAccounts],
  );

  /** Xóa tài khoản = xóa sạch dữ liệu của họ, nên phải nạp lại cả hai phía. */
  const deleteAccount = useCallback(
    async (id: string) => {
      try {
        await api(`/api/admin/users/${id}`, "DELETE");
        if (scopeUserId === id) setScopeUserId(null);
        await loadAccounts();
        await refresh();
      } catch (e) {
        fail(e);
      }
    },
    [fail, loadAccounts, refresh, scopeUserId],
  );

  if (screen === "login") {
    return (
      <LoginScreen
        onDone={async (who) => {
          setUser(who);
          setScopeUserId(null);
          if (who.role === "admin") await loadAccounts().catch(() => undefined);
          // Dữ liệu render sẵn ở server là của phiên trước (hoặc rỗng) — nạp lại
          // theo đúng tài khoản vừa vào.
          await refresh().catch(fail);
          setScreen("dashboard");
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        screen={screen}
        theme={theme}
        user={user}
        onNavigate={(s) => {
          setScreen(s);
          setSelectedPageId(null);
        }}
        onToggleTheme={toggleTheme}
      />

      <main className="crm-scroll" style={{ flex: 1, minWidth: 0, height: "100vh", overflow: "auto" }}>
        <Topbar
          title={TITLES[screen]}
          showFilters={screen === "dashboard" || screen === "catalog"}
          groups={groups}
          niches={niches}
          groupFilter={groupFilter}
          nicheFilter={nicheFilter}
          onGroupFilter={setGroupFilter}
          onNicheFilter={setNicheFilter}
          onImport={() => {
            setManageTab("import");
            setScreen("manage");
          }}
          user={user}
          accounts={accounts}
          scopeUserId={scopeUserId}
          onScope={changeScope}
          onLogout={async () => {
            await fetch("/api/login", { method: "DELETE" }).catch(() => undefined);
            setUser(null);
            // Xóa sạch dữ liệu trong bộ nhớ để tài khoản sau không thấy của trước.
            setNiches([]);
            setPages([]);
            setGroups([]);
            setSubs([]);
            setTopPosts([]);
            setTrends([]);
            setSnapshots([]);
            setOwners([]);
            setAccounts([]);
            setScopeUserId(null);
            setDefaultPassword(false);
            setSelectedPageId(null);
            setSelected({});
            setScreen("login");
          }}
        />

        {error && (
          <div
            style={{
              margin: "14px 26px 0",
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--danger-soft)",
              color: "var(--danger)",
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}

        {screen === "dashboard" && (
          <Dashboard
            niches={niches}
            pages={pages}
            topPosts={topPosts}
            trends={trends}
            snapshots={snapshots}
            owners={owners}
            nicheFilter={nicheFilter}
            negThreshold={initial.negThreshold}
            theme={theme}
            onNicheFilter={setNicheFilter}
            onOpenPage={(id) => {
              setSelectedPageId(id);
              setScreen("page");
            }}
            onOpenOwner={user?.role === "admin" ? changeScope : undefined}
            onImport={() => {
              setManageTab("import");
              setScreen("manage");
            }}
          />
        )}

        {screen === "catalog" && (
          <Catalog
            niches={niches}
            groups={visibleGroups}
            subs={subs}
            pages={visiblePages}
            owners={owners}
            selected={selected}
            theme={theme}
            onToggleSelect={(id) => setSelected((s) => ({ ...s, [id]: !s[id] }))}
            onSelectMany={(ids, on) =>
              setSelected((s) => {
                const next = { ...s };
                ids.forEach((id) => (next[id] = on));
                return next;
              })
            }
            onOpenPage={(id) => {
              setSelectedPageId(id);
              setScreen("page");
            }}
            onMovePage={movePage}
            onOpenModal={setModal}
          />
        )}

        {screen === "manage" && (
          <Manage
            tab={manageTab}
            onTab={setManageTab}
            niches={niches}
            groups={groups}
            subs={subs}
            pages={pages}
            onImported={() => refresh().catch(fail)}
            onAssignNiche={changeNiche}
            onMovePage={movePage}
            onBulk={bulkChange}
            onDeletePage={deletePage}
          onDeletePages={deletePages}
            onCreateGroup={createGroup}
            onRenameGroup={renameGroup}
            onDeleteGroup={deleteGroup}
          onDeleteGroups={deleteGroups}
            onCreateSub={createSub}
            onRenameSub={renameSub}
            onDeleteSub={deleteSub}
            onOpenNicheModal={setModal}
            onDeleteNiche={deleteNiche}
            owners={owners}
            users={
              user?.role === "admin"
                ? {
                    list: accounts,
                    me: user.id,
                    scopeUserId,
                    defaultPassword,
                    onCreate: createAccount,
                    onUpdate: updateAccount,
                    onDelete: deleteAccount,
                    onOpenScope: changeScope,
                  }
                : undefined
            }
          />
        )}

        {screen === "page" && detailPage && (
          <PageDetail
            page={detailPage}
            niches={niches}
            groups={groups}
            topPosts={topPosts}
            hot={hotLevel(detailPage.views)}
            negThreshold={initial.negThreshold}
            onBack={() => {
              setScreen("catalog");
              setSelectedPageId(null);
            }}
            onChangeNiche={(nicheId) => changeNiche(detailPage.id, nicheId)}
          />
        )}
      </main>

      {selectedIds.length > 0 && screen !== "manage" && (
        <BulkBar
          count={selectedIds.length}
          niches={niches}
          onAssign={bulkAssign}
          onDelete={() => deletePages(selectedIds)}
          onClear={() => setSelected({})}
        />
      )}

      {modal && (
        <NicheModal
          draft={modal}
          pages={pages}
          niches={niches}
          onClose={() => setModal(null)}
          onSave={saveNiche}
        />
      )}
    </div>
  );
}
