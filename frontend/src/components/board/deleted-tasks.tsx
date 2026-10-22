"use client";

import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { avatarClass, initials } from "@/lib/dashboard";
import { agoParts, boardErrorKey, daysLeft, useDeletedTasks, useRestoreTask } from "@/lib/board";
import "./board.css";

const UNDO = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;

// STATE-TSK-RESTORE. A deleted task can be restored for 30 days; project admins only (the server returns an empty list to everyone else).
export function DeletedTasks({ projectId, blocked, onOpen }: { projectId: string; blocked: boolean; onOpen: (id: string) => void }) {
  const t = useTranslations("Board");
  const { workspace, notify } = useShell();
  const list = useDeletedTasks(projectId, true);
  const restore = useRestoreTask(projectId, workspace?.id);
  const rows = list.data ?? [];

  async function onRestore(id: string) {
    try {
      await restore.mutateAsync(id);
      notify(t("restored"));
    } catch (err) {
      notify(t(boardErrorKey(err)));
    }
  }

  return (
    <section className="ap-card bd-trash" id="bd-trashlist" aria-labelledby="bd-trash-h">
      <header className="ap-ch"><h2 id="bd-trash-h"><span>{t("deletedH")}</span> <span className="st-count" id="bd-trash-n">{list.isPending ? "" : rows.length}</span></h2><span className="st-note">{t("trashNote")}</span></header>
      <ul className="bd-tl" id="bd-tl" aria-busy={list.isFetching}>
        {list.isPending ? null : rows.length ? rows.map((tk) => {
          const ago = agoParts(tk.deletedAt);
          const busy = restore.isPending && restore.variables === tk.id;
          return (
            <li className="bd-tli" key={tk.id}>
              <span className="bd-tlt"><b>{tk.title}</b><small>{t("deletedAgo")} {t(ago.key, { n: ago.n })} · {t("removedIn", { n: daysLeft(tk.purgeAt) })}</small></span>
              <span className="bd-tlm"><span className={`bd-av ${avatarClass(tk.author.id)}`} title={tk.author.name}>{initials(tk.author.name)}</span><small>{tk.author.name}</small></span>
              <span className="bd-tla">
                <button type="button" className="pm-btn pm-ghost st-sm" onClick={() => onOpen(tk.id)}>{t("open")}</button>
                <button type="button" className="pm-btn pm-go st-sm" disabled={blocked || busy} aria-busy={busy} onClick={() => void onRestore(tk.id)}>{UNDO} {t("restore")}</button>
              </span>
            </li>
          );
        }) : <li className="bd-tl-empty">{t("trashNone")}</li>}
      </ul>
    </section>
  );
}
