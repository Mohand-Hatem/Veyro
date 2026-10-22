"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { avatarClass, initials } from "@/lib/dashboard";
import { boardErrorKey, useProjectMemberActions, useWorkspaceMembers, type BoardProject } from "@/lib/board";
import "@/components/dashboard/illustration.css";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "@/components/projects/project-dialogs.css";
import "@/components/ui/badges.css";
import "./board-dialogs.css";

type Role = "ADMIN" | "MEMBER";

// Project members (CS-05, ADR-012). Markup and class names follow screens/groups/04-projects-tasks/board.html (Parity Gate).
// Project admins manage the list; everyone else only reads it. The server enforces every rule: the creator is protected,
// nobody changes their own role, and an archived or read-only project accepts no changes.
export function MembersDialog({ open, project, blocked, onClose }: { open: boolean; project: BoardProject; blocked: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="pm st-dlg pmb" id="pmb-dlg" aria-labelledby="pmb-t" onClose={onClose}>
      {open && <MembersBody project={project} blocked={blocked} onClose={onClose} />}
    </dialog>
  );
}

function MembersBody({ project, blocked, onClose }: { project: BoardProject; blocked: boolean; onClose: () => void }) {
  const t = useTranslations("Board");
  const { workspace, notify } = useShell();
  const v = project.viewer;
  // Roles and removals follow the viewer's rights only (the server accepts them on a read-only project); adding people needs an editable project.
  const canManage = v.canManageMembers;
  const canAdd = canManage && !blocked;
  const pool = useWorkspaceMembers(workspace?.id, canAdd);
  const act = useProjectMemberActions(project.id, workspace?.id);
  const [pick, setPick] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [busyId, setBusyId] = useState<string | null>(null);

  const inProject = new Set(project.members.map((m) => m.userId));
  const addable = (pool.data ?? []).filter((m) => !inProject.has(m.userId));
  const picked = addable.some((m) => m.userId === pick) ? pick : (addable[0]?.userId ?? "");

  async function run(id: string, job: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await job();
      notify(ok);
    } catch (err) {
      notify(t(boardErrorKey(err)));
    } finally {
      setBusyId(null);
    }
  }
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const who = addable.find((m) => m.userId === picked);
    if (who) void run("add", () => act.add.mutateAsync({ userId: who.userId, role }), `${t("pmAdded")}: ${who.name}`);
  };

  return (
    <div className="st-dlg-in">
      <header className="pm-head">
        <div><h2 id="pmb-t">{t("pmTitle")}</h2><p>{t("pmSub")}</p></div>
        <button type="button" className="pm-x" id="pmb-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
      </header>
      <ul className="pmb-list" id="pmb-list">
        {project.members.map((m) => {
          const self = m.userId === v.userId;
          const creator = m.userId === project.createdById;
          const locked = !canManage || (creator && !v.isWorkspaceOverride) || (self && !v.isWorkspaceOverride);
          const busy = busyId === m.userId;
          return (
            <li className="pmb-row" key={m.userId}>
              <span className="pmb-who">
                <span className={`bd-av ${avatarClass(m.user.id)} pmb-av`} title={m.user.name}>{initials(m.user.name)}</span>
                <span><b>{m.user.name}</b>{creator && <i className="pmb-tag">{t("prCREATOR")}</i>}{self && <i className="pmb-tag">{t("pmYou")}</i>}</span>
              </span>
              <span className="pmb-r">
                {locked ? (
                  <span className={`st-badge ${m.role === "ADMIN" ? "b-admin" : "b-member"}`}>{t(`pr${m.role}`)}</span>
                ) : (
                  <label className="ap-select pmb-rsel"><span className="ap-sr">{t("pmRole")}: {m.user.name}</span>
                    <select value={m.role} disabled={busy} onChange={(e) => { const r = e.target.value as Role; void run(m.userId, () => act.setRole.mutateAsync({ userId: m.userId, role: r }), `${t("pmRoleOk")}: ${m.user.name} → ${t(`pr${r}`)}`); }}>
                      <option value="MEMBER">{t("prMEMBER")}</option>
                      <option value="ADMIN">{t("prADMIN")}</option>
                    </select>
                  </label>
                )}
              </span>
              <span className="pmb-x">
                {!locked && (
                  <button type="button" className="st-icon" disabled={busy} aria-label={`${t("pmRemove")} ${m.user.name}`} onClick={() => void run(m.userId, () => act.remove.mutateAsync(m.userId), t("pmRemoved"))}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <form className="pmb-add" id="pmb-addf" onSubmit={onAdd} hidden={!canAdd || !addable.length}>
        <label className="ap-sr" htmlFor="pmb-pick">{t("pmAdd")}</label>
        <span className="ap-select"><select id="pmb-pick" value={picked} onChange={(e) => setPick(e.target.value)}>{addable.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select></span>
        <label className="ap-sr" htmlFor="pmb-role">{t("pmRole")}</label>
        <span className="ap-select"><select id="pmb-role" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="MEMBER">{t("prMEMBER")}</option><option value="ADMIN">{t("prADMIN")}</option></select></span>
        <button type="submit" className="pm-btn pm-go st-sm" id="pmb-addbtn" disabled={busyId === "add"}>{t("pmAdd")}</button>
      </form>
      <p className="pm-hint" id="pmb-none" hidden={!canAdd || pool.isPending || addable.length > 0}>{t("pmNone")}</p>
      <div className="pm-foot"><button type="button" className="pm-btn pm-ghost" id="pmb-done" onClick={onClose}>{t("pmDone")}</button></div>
    </div>
  );
}
