"use client";

import type { MouseEvent, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { avatarClass } from "@/lib/dashboard";
import { ago, badgeText, noticeHref, useMarkAllRead, useMarkRead, useNotifications, useUnreadCount, type Notice } from "@/lib/notifications";
import "@/components/dashboard/illustration.css";
import "./notifications.css";

const bold = { b: (c: ReactNode) => <b>{c}</b> };

// The bell and its popover (SCR-SHELL, step 5.9 Phase C). Markup and class names follow
// screens/groups/07-avatar-notifications/notifications.html (design.md 5.44). The unread count is polled once a minute; the list loads when it opens.
export function NotificationsBell({ open, onToggle, onClose, icon }: { open: boolean; onToggle: (e: MouseEvent) => void; onClose: () => void; icon: ReactNode }) {
  const t = useTranslations("Notifications");
  const unread = useUnreadCount().data ?? 0;
  const badge = badgeText(unread);
  return (
    <div className="ap-bellbox" data-pop="bell">
      <button type="button" className="ap-pill-btn ap-bell nf-bellbtn" id="ap-bell" aria-label={badge ? t("bellUnread", { n: unread }) : t("bell")} aria-haspopup="dialog" aria-expanded={open} aria-controls="ap-bellpop" onClick={onToggle}>
        {icon}
        {badge && <span className="nf-badge" aria-hidden="true">{badge}</span>}
      </button>
      <div className="ap-bellpop" id="ap-bellpop" role="dialog" aria-label={t("bell")} hidden={!open}>
        {open && <Popover unread={unread} onClose={onClose} />}
      </div>
    </div>
  );
}

function Popover({ unread, onClose }: { unread: number; onClose: () => void }) {
  const t = useTranslations("Notifications");
  const q = useNotifications(true);
  const markAll = useMarkAllRead();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <div className="nf-head">
        <h2>{t("title")}</h2>
        <button type="button" className="nf-all" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>{t("markAll")}</button>
      </div>
      {q.isPending ? (
        <div role="status" aria-label={t("loading")}>{[0, 1, 2].map((i) => <div className="nf-sk" key={i}><i /><span /></div>)}</div>
      ) : q.isError && items.length === 0 ? (
        <div className="nf-err" role="alert">
          <b>{t("errT")}</b>
          <p>{t("errD")}</p>
          <button type="button" className="nf-more" onClick={() => q.refetch()}>{t("retry")}</button>
        </div>
      ) : items.length === 0 ? (
        <Empty />
      ) : (
        <>
          <ul className="nf-list">{items.map((n) => <Row key={n.id} n={n} onClose={onClose} />)}</ul>
          {q.hasNextPage && (
            <div className="nf-foot"><button type="button" className="nf-more" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t("more")}</button></div>
          )}
        </>
      )}
    </>
  );
}

function Row({ n, onClose }: { n: Notice; onClose: () => void }) {
  const t = useTranslations("Notifications");
  const tag = useLocale() === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const markRead = useMarkRead();
  const d = n.data;
  const actor = n.actor?.name ?? d.actorName ?? "";
  const text =
    n.type === "TASK_ASSIGNED" ? t.rich("assigned", { actor, task: d.taskTitle, ...bold })
    : n.type === "TASK_COMMENTED" ? t.rich("commented", { actor, task: d.taskTitle, ...bold })
    : n.type === "ADDED_TO_PROJECT" ? t.rich("added", { actor, project: d.projectName, ...bold })
    : n.type === "ROLE_CHANGED" ? t.rich(d.role === "ADMIN" ? "roleAdmin" : "roleMember", { actor, workspace: d.workspaceName, ...bold })
    : t.rich("accepted", { actor, workspace: d.workspaceName, ...bold });
  const href = noticeHref(n);
  const body = (
    <>
      {n.actor ? <Avatar className={`nf-av ${avatarClass(n.actor.id)}`} name={n.actor.name} url={n.actor.avatarUrl} /> : <span className="nf-av nf-av-none" aria-hidden="true" />}
      <div>
        <p className="nf-t">{text}</p>
        <div className="nf-m">{d.projectKey && <span className="nf-key">{d.projectKey}</span>}<span>{ago(n.createdAt, tag)}</span></div>
      </div>
      {!n.readAt ? <i className="nf-dot" role="img" aria-label={t("unread")} /> : <span />}
    </>
  );
  const cls = `nf-it${n.readAt ? "" : " is-unread"}`;
  const click = () => { if (!n.readAt) markRead.mutate(n.id); onClose(); };
  return <li>{href ? <Link href={href} className={cls} onClick={click}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

function Empty() {
  const t = useTranslations("Notifications");
  return (
    <div className="nf-empty">
      <div className="il-scene nf-scene">
        <div className="il-illu">
          <svg viewBox="0 0 300 150" role="img" aria-label={t("sceneAlt")}>
            <rect className="il-paper il-line" x="62" y="20" width="176" height="112" rx="18" />
            <path className="il-brandfill" d="M150 44c-17 0-26 14-26 32v14l-9 10h70l-9-10V76c0-18-9-32-26-32z" />
            <circle className="il-brandfill" cx="150" cy="40" r="4.5" />
            <circle className="il-brandfill" cx="150" cy="110" r="7" />
            <path d="M142 70q3 4 8 0M152 70q3 4 8 0" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <text className="il-t3" x="196" y="50" style={{ fontSize: "17px" }}>z</text>
            <text className="il-t3" x="208" y="38" style={{ fontSize: "12px" }}>z</text>
            <circle className="il-tick-c" cx="238" cy="26" r="13" />
            <path className="il-tick" d="M232 26l4.5 4.5L244 22" />
          </svg>
        </div>
      </div>
      <b>{t("emptyT")}</b>
      <p>{t("emptyD")}</p>
    </div>
  );
}
