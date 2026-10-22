"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { BOTTOM_NAV, NAV, isActive, roleOf, visibleNav, type NavKey, type Role } from "@/lib/nav";
import { useMe, useWorkspaces } from "@/lib/queries";
import { Loader } from "@/components/loader/loader";
import { ErrorCard } from "@/components/state/error-card";
import { Forbidden } from "@/components/state/forbidden";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { AskPanel } from "@/components/assistant/ask-panel";
import { useAskPanel } from "@/components/assistant/use-ask-panel";
import { useDashboard } from "@/lib/dashboard";
import { useProjectList } from "@/lib/projects";
import { Icons, NavIcon } from "./icons";
import { ShellContext } from "./shell-context";
import { useStoredFlag } from "./use-stored-flag";
import "./shell.css";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const NAV_LABEL: Record<NavKey, string> = { dashboard: "navDash", projects: "navProj", tasks: "navTasks", ai: "navAi", audit: "navAudit", members: "navMembers", billing: "navBilling" };
const ROLE_LABEL: Record<Role, string> = { owner: "roleOwner", admin: "roleAdmin", member: "roleMember" };

// Markup and class names follow screens/groups/03-workspace-dashboard/index.html (Parity Gate).
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Shell");
  const tc = useTranslations("CreateProject");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const slug = useParams<{ workspaceSlug?: string }>().workspaceSlug;
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const me = useMe();
  const workspaces = useWorkspaces();

  const [collapsed, setCollapsed] = useStoredFlag("veyro-sb");
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState<"ws" | "bell" | "user" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [wsCreateOpen, setWsCreateOpen] = useState(false);
  const ask = useAskPanel();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const list = workspaces.data ?? [];
  // Account pages (billing) have no workspace in the address: the owner's workspace stands in, so the sidebar still has a context.
  // The same goes for an address that is not one of the person's workspaces: the access page is shown inside a working shell.
  const fallback = list.find((w) => w.isAccountOwner) ?? list[0];
  const found = slug ? list.find((w) => w.slug === slug) : undefined;
  const unknownWs = workspaces.isSuccess && !!slug && !found;
  const current = slug ? (found ?? (unknownWs ? fallback : undefined)) : fallback;
  const role: Role = current ? roleOf(current) : "member";
  const user = me.data;
  const roleLabel = current ? t(ROLE_LABEL[role]) : ""; // no role to show until the workspace has loaded
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // Creating a project is blocked while the plan is full or downgraded (the dashboard read model says so); the button explains why.
  const planInfo = useDashboard(role !== "member" ? current?.id : undefined).data;
  const createBlocked = !!planInfo?.capacity && (planInfo.capacity.currentProjects >= planInfo.capacity.maxProjects || planInfo.notices?.billingState === "READ_ONLY");
  const openCreateProject = () => {
    setDrawer(false);
    setOpen(null);
    if (createBlocked) notify(tc("blocked"));
    else setCreateOpen(true);
  };

  // A session that cannot be renewed sends the user to sign-in and back.
  const unauthorized = [me.error, workspaces.error].some((e) => e instanceof ApiError && e.status === 401);
  useEffect(() => {
    if (unauthorized) router.replace({ pathname: "/login", query: { next: pathname } });
  }, [unauthorized, pathname, router]);

  // A signed-in person without any workspace starts at onboarding.
  const noWorkspace = workspaces.isSuccess && list.length === 0;
  useEffect(() => {
    if (noWorkspace) router.replace("/onboarding");
  }, [noWorkspace, router]);

  // Remember the last workspace so /dashboard can return to it.
  useEffect(() => {
    if (current) {
      try {
        localStorage.setItem("veyro-ws", current.slug);
      } catch {
        /* storage unavailable */
      }
    }
  }, [current]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setOpen(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-pop]")) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    if (open === "user") userMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      queryClient.clear();
      router.replace({ pathname: "/login", query: { signedout: "1" } });
    }
  }

  const menuKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  };

  const toggle = (which: "ws" | "bell" | "user") => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((o) => (o === which ? null : which));
  };
  const later = (e: React.MouseEvent) => {
    e.preventDefault();
    setDrawer(false);
    setOpen(null);
    notify(t("later"));
  };

  const items = visibleNav(role);
  // The account audit trail is a child of Billing: that item stays lit and the page has its own title.
  const accountAudit = pathname === "/account/audit";
  // Pages that belong to the person, not to a workspace section: no item is lit, the dashboard search stays away, the header names the page.
  const plainKey = ({ "/account/profile": "profile", "/help/contact": "contact", "/help": "guide" } as const)[pathname as "/help"];
  const activeKey = accountAudit ? "billing" : NAV.find((n) => current && isActive(pathname, n.href(current.slug), n.key))?.key ?? "dashboard";
  // On a project board the page title is the project's name (the key in the URL is looked up in the cached project list).
  const boardKey = pathname.match(/\/projects\/([^/]+)(?:\/tasks\/[^/]+)?$/)?.[1];
  const boardProject = useProjectList(boardKey ? current?.id : undefined).data?.find((p) => p.key.toLowerCase() === boardKey?.toLowerCase());
  const title = titleOverride ?? boardProject?.name ?? t(accountAudit ? "navAccountAudit" : plainKey ?? NAV_LABEL[activeKey]);
  const link = (key: NavKey, label: string, bottom = false) => {
    const def = NAV.find((n) => n.key === key)!;
    const href = def.href(current?.slug ?? "");
    const on = !!current && (accountAudit ? key === "billing" : isActive(pathname, href, key));
    const body = (
      <>
        <NavIcon k={key} />
        <span className={bottom ? undefined : "ap-hide-c"}>{label}</span>
      </>
    );
    return def.built && current ? (
      <Link key={key} href={href} className={on ? "is-on" : undefined} aria-current={on ? "page" : undefined} onClick={() => setDrawer(false)}>{body}</Link>
    ) : (
      <a key={key} href={href} onClick={later}>{body}</a>
    );
  };

  return (
    <ShellContext.Provider value={{ workspace: current, role, user, notify, search, openCreateProject, setTitle: setTitleOverride }}>
      <div className="app" data-role={role} data-collapsed={String(collapsed)} data-drawer={drawer ? "open" : "closed"}>
        <a className="ap-skip" href="#main">{t("skip")}</a>
        <div className="ap-shell">
          {/* ================= SIDEBAR ================= */}
          <aside className="ap-sb" id="ap-sb" aria-label={t("sidebarLabel")}>
            <div className="ap-sb-top">
              <Link href="/" className="ap-logo" aria-label="Veyro home"><Image src="/logo.png" alt="" width={36} height={36} /><span className="ap-hide-c">Veyro</span></Link>
              <button type="button" className="ap-collapse" id="ap-collapse" aria-label={collapsed ? t("expand") : t("collapse")} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{Icons.collapse}</button>
            </div>

            <div className="ap-wsbox" data-pop="ws">
              <button type="button" className="ap-ws" id="ap-ws" aria-label={t("switchWs")} aria-haspopup="listbox" aria-expanded={open === "ws"} aria-controls="ap-wsmenu" onClick={toggle("ws")}>
                <span className="ap-ws-av">{current ? initials(current.name) : "—"}</span>
                <span className="ap-ws-t ap-hide-c"><b>{current?.name ?? "—"}</b><small id="ap-ws-role">{roleLabel}</small></span>
                {Icons.chevrons}
              </button>
              <div className="ap-wsmenu" id="ap-wsmenu" role="listbox" aria-label={t("wsLabel")} hidden={open !== "ws"}>
                <p className="ap-wsm-l">{t("wsLabel")}</p>
                {list.map((w) => {
                  const on = w.slug === current?.slug;
                  return (
                    <button key={w.id} type="button" role="option" aria-selected={on} className={`ap-wsm-i${on ? " on" : ""}`} onClick={() => { setOpen(null); router.push(`/w/${w.slug}`); }}>
                      <span className={`ap-ws-av${on ? "" : " alt"}`}>{initials(w.name)}</span>
                      <span><b>{w.name}</b><small>{t(ROLE_LABEL[roleOf(w)])}</small></span>
                    </button>
                  );
                })}
                {role === "owner" && <button type="button" className="ap-wsm-new" onClick={() => { setOpen(null); setDrawer(false); setWsCreateOpen(true); }}>+ {t("wsCreate")}</button>}
              </div>
            </div>

            {role !== "member" && (
              <button type="button" className={`ap-create${createBlocked ? " is-blocked" : ""}`} id="ap-create" aria-haspopup="dialog" aria-disabled={createBlocked} onClick={openCreateProject}>
                <span className="ap-create-ic">{Icons.plus}</span>
                <span className="ap-hide-c">{t("create")}</span>
              </button>
            )}

            <nav className="ap-nav" aria-label={t("primaryNav")}>{items.map((n) => link(n.key, t(NAV_LABEL[n.key])))}</nav>

            <div className="ap-sb-help">
              <div className="ap-sb-acct">
                <Link href="/account/profile" onClick={() => setDrawer(false)}>{Icons.user}<span>{t("profile")}</span></Link>
                <button type="button" onClick={signOut}>{Icons.out}<span>{t("signOut")}</span></button>
              </div>
              <Link className="ap-help ap-help-guide" href="/help" data-tip={t("guide")} aria-label={t("guide")} onClick={() => setDrawer(false)}>{Icons.help}</Link>
              <Link className="ap-help ap-help-contact" href="/help/contact" data-tip={t("contact")} aria-label={t("contact")} onClick={() => setDrawer(false)}>{Icons.mail}</Link>
            </div>
          </aside>
          <div className="ap-scrim" id="ap-scrim" hidden={!drawer} onClick={() => setDrawer(false)} />

          {/* ================= MAIN ================= */}
          <div className="ap-main">
            <header className="ap-top">
              <button type="button" className="ap-burger" id="ap-burger" aria-label={t("openNav")} aria-controls="ap-sb" onClick={() => setDrawer(true)}>{Icons.burger}</button>
              <h1>{title}</h1>
              <div className="ap-top-r">
                {/* Only the dashboard has the top-bar search (it filters the project table and My tasks); the lists have their own. */}
                {activeKey === "dashboard" && !plainKey && titleOverride === null && (
                  <label className="ap-search">
                    {Icons.search}
                    <span className="ap-sr">{t("searchLabel")}</span>
                    <input ref={searchRef} id="ap-q" type="search" placeholder={t("searchPh")} autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <kbd>⌘K</kbd>
                  </label>
                )}
                <button type="button" className="ap-pill-btn ap-ai" aria-label={t("askAi")} aria-haspopup="dialog" aria-expanded={ask.open} onClick={(e) => (ask.open ? ask.hide() : ask.show(e.currentTarget))}>{Icons.ai}</button>
                <div className="ap-bellbox" data-pop="bell">
                  <button type="button" className="ap-pill-btn ap-bell" id="ap-bell" aria-label={t("notifications")} aria-haspopup="dialog" aria-expanded={open === "bell"} aria-controls="ap-bellpop" onClick={toggle("bell")}>{Icons.bell}</button>
                  <div className="ap-bellpop" id="ap-bellpop" role="dialog" aria-label={t("notifications")} hidden={open !== "bell"}>
                    <span className="ap-soon">{t("soon")}</span>
                    <b>{t("notifTitle")}</b>
                    <p>{t("notifText")}</p>
                  </div>
                </div>
                <button type="button" className="ap-pill-btn js-theme-toggle" aria-label={t("toggleTheme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{Icons.moon}{Icons.sun}</button>
                <button type="button" className="ap-pill-btn ap-lang js-lang-toggle" aria-label={t("switchLanguage")} onClick={() => router.replace(pathname, { locale: locale === "ar" ? "en" : "ar" })}>
                  <span className="js-lang-label">{locale === "ar" ? "EN" : "ع"}</span>
                </button>
                <div className="ap-userbox" data-pop="user">
                  <button type="button" className="ap-user" aria-label={t("accountMenu")} aria-haspopup="menu" aria-expanded={open === "user"} onClick={toggle("user")}>
                    <span className="ap-user-av">{user ? initials(user.name) : "—"}</span>
                    <span className="ap-user-t"><b>{user?.name ?? "—"}</b><small id="ap-user-role">{roleLabel}</small></span>
                    {Icons.caret}
                  </button>
                  <div className="ap-umenu" role="menu" ref={userMenuRef} hidden={open !== "user"} onKeyDown={menuKeys}>
                    <div className="ap-um-head">
                      <span className="ap-user-av" aria-hidden="true">{user ? initials(user.name) : "—"}</span>
                      <span className="ap-um-who"><small>{t("signedAs")}</small><b>{user?.name}</b><small>{user?.email}</small><em>{roleLabel}</em></span>
                    </div>
                    <Link role="menuitem" className="ap-um-i" href="/account/profile" onClick={() => setOpen(null)}>{Icons.user}<span>{t("profile")}</span></Link>
                    <Link role="menuitem" className="ap-um-i" href="/help" onClick={() => setOpen(null)}>{Icons.menuHelp}<span>{t("guide")}</span></Link>
                    <button role="menuitem" type="button" className="ap-um-i is-out" onClick={signOut}>{Icons.out}<span>{t("signOut")}</span></button>
                  </div>
                </div>
              </div>
            </header>

            <main id="main" className="ap-body">
              <ShellBody loading={workspaces.isLoading || me.isLoading} failed={(workspaces.isError || me.isError) && !unauthorized} onRetry={() => { workspaces.refetch(); me.refetch(); }} empty={workspaces.isSuccess && list.length === 0} unknown={unknownWs} firstSlug={fallback?.slug}>{children}</ShellBody>
            </main>
          </div>

          <nav className="ap-bn" aria-label={t("quickNav")}>{BOTTOM_NAV.map((k) => link(k, t(k === "ai" ? "navAiShort" : NAV_LABEL[k]), true))}</nav>
        </div>
        <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
        <CreateWorkspaceDialog open={wsCreateOpen} onClose={() => setWsCreateOpen(false)} />
        {current && <AskPanel open={ask.open} onClose={ask.hide} />}
        <div className={`ap-toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
      </div>
    </ShellContext.Provider>
  );
}

// What the content area shows before a workspace is available.
function ShellBody({ loading, failed, onRetry, empty, unknown, firstSlug, children }: { loading: boolean; failed: boolean; onRetry: () => void; empty: boolean; unknown: boolean; firstSlug?: string; children: ReactNode }) {
  const t = useTranslations("Shell");
  if (loading) return <Loader />;
  if (failed) return <ErrorCard title={t("loadErrorTitle")} text={t("loadErrorText")} retryLabel={t("retry")} onRetry={onRetry} />;
  if (unknown) return <Forbidden from="workspace" slug={firstSlug} />;
  if (empty) {
    return (
      <section className="grid max-w-md gap-2 py-8" role="status">
        <h2 className="text-xl font-bold">{t("noWorkspaceTitle")}</h2>
        <p className="text-muted-foreground">{t("noWorkspaceText")}</p>
      </section>
    );
  }
  return <>{children}</>;
}
