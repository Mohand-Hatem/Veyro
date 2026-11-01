"use client";
/* eslint-disable @next/next/no-img-element -- previews are short-lived private links: next/image would copy them through a public optimizer cache */

import { useRef, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/components/dashboard/use-format";
import { ApiError } from "@/lib/api";
import { usePersonName } from "@/lib/person";
import { notify } from "@/lib/toast";
import { FILE_ACCEPT, FILES_PER_TASK, fileProblem, formatBytes, useTaskFiles, type Attachment, type TaskDetail } from "@/lib/task";
import "./task-files.css";

const DOWNLOAD = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
const TRASH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
const LOCK = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
const UP = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 19h14" /></svg>;

/** The colour family of a type tile, so a PDF, a spreadsheet and a slide deck are told apart at a glance. */
const TILE: Record<string, string> = { pdf: "pdf", doc: "doc", docx: "doc", xls: "xls", xlsx: "xls", csv: "xls", ppt: "ppt", pptx: "ppt", txt: "txt" };

type Upload = { key: string; name: string; share: number; error?: string };

const ERROR_KEY: Record<string, string> = { FILE_TOO_LARGE: "fileBig", FILE_TYPE_NOT_ALLOWED: "fileType", ATTACHMENT_LIMIT: "fileLimit", STORAGE_NOT_CONFIGURED: "fileOff" };

/**
 * Files on a task. What shows follows the rights the server sends: cards with links for the people who may open the files,
 * an upload area for the people who may add them, and only the count, behind a lock, for everyone else.
 */
export function TaskFiles({ task }: { task: TaskDetail }) {
  const t = useTranslations("Task");
  const v = task.viewer;
  const files = useTaskFiles(task.id);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const deleted = !!task.deletedAt;
  const canRemove = !deleted && (v.isProjectAdmin || v.isTaskAuthor);
  const room = FILES_PER_TASK - task.attachmentCount - uploads.filter((u) => !u.error).length;

  if (!v.canOpenFiles) {
    if (!task.attachmentCount) return null;
    return (
      <p className="tf-locked" id="tf-locked">{LOCK}<span>{t("filesLocked", { n: task.attachmentCount })}</span></p>
    );
  }
  if (!task.attachmentCount && !v.canUpload && !uploads.length) return null;

  const patch = (key: string, change: Partial<Upload>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...change } : u)));

  async function add(list: FileList | File[]) {
    let left = room;
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
      const problem = left <= 0 ? "fileLimit" : fileProblem(file);
      setUploads((u) => [...u, { key, name: file.name, share: 0, ...(problem ? { error: t(problem) } : {}) }]);
      if (problem) continue;
      left--;
      try {
        await files.upload(file, (share) => patch(key, { share }));
        setUploads((u) => u.filter((x) => x.key !== key)); // the card from the server replaces the progress row
        notify(t("fileAdded", { name: file.name }));
      } catch (err) {
        patch(key, { error: t(err instanceof ApiError && ERROR_KEY[err.code] ? ERROR_KEY[err.code] : "fileFail") });
      }
    }
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (v.canUpload && e.dataTransfer.files.length) void add(e.dataTransfer.files);
  }

  return (
    <section className="tf" aria-labelledby="tf-h">
      <div className="tf-head"><h3 id="tf-h">{t("files")}</h3><span className="st-count">{task.attachmentCount}</span></div>
      {task.attachments.length > 0 && (
        <ul className="tf-grid" id="tf-list">
          {task.attachments.map((a) => <FileCard key={a.id} file={a} canRemove={canRemove} files={files} />)}
        </ul>
      )}
      {uploads.length > 0 && (
        <ul className="tf-ups" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className={u.error ? "is-err" : undefined}>
              <span className="tf-up-name" dir="auto">{u.name}</span>
              {u.error
                ? <><span className="tf-up-err">{u.error}</span><button type="button" className="tf-x" onClick={() => setUploads((l) => l.filter((x) => x.key !== u.key))} aria-label={t("dismiss")}>×</button></>
                : <span className="tf-bar" role="progressbar" aria-label={t("uploading", { name: u.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.share * 100)}><span style={{ width: `${Math.round(u.share * 100)}%` }} /></span>}
            </li>
          ))}
        </ul>
      )}
      {v.canUpload && (
        <div
          className={`tf-drop${over ? " is-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <span className="tf-drop-ic">{UP}</span>
          <span className="tf-drop-t">
            <b>{t("filesDrop")}</b>
            <button type="button" className="tf-choose" onClick={() => input.current?.click()}>{t("filesChoose")}</button>
          </span>
          <small>{t("filesHint", { n: FILES_PER_TASK })}</small>
          <input ref={input} type="file" multiple accept={FILE_ACCEPT} hidden aria-label={t("filesChoose")} onChange={(e) => { if (e.target.files?.length) void add(e.target.files); e.target.value = ""; }} />
        </div>
      )}
    </section>
  );
}

function FileCard({ file, canRemove, files }: { file: Attachment; canRemove: boolean; files: ReturnType<typeof useTaskFiles> }) {
  const t = useTranslations("Task");
  const tb = useTranslations("Board");
  const locale = useLocale();
  const pn = usePersonName();
  const { date } = useFormat();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");

  /** Links expire, so a download always asks for a fresh one first. */
  async function download(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    try {
      const fresh = (await files.fresh()).attachments.find((a) => a.id === file.id);
      window.location.assign(fresh?.downloadUrl ?? file.downloadUrl ?? "");
    } catch {
      if (file.downloadUrl) window.location.assign(file.downloadUrl);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await files.remove(file.id);
      notify(t("fileRemoved", { name: file.fileName }));
    } catch {
      setFailed(t("fileFail"));
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <li className="tf-card">
      {file.isImage && file.previewUrl
        ? <img className="tf-thumb" src={file.previewUrl} alt="" loading="lazy" />
        : <span className={`tf-thumb tf-tile t-${TILE[file.format] ?? "txt"}`} aria-hidden="true">{file.format.toUpperCase()}</span>}
      <div className="tf-info">
        <b dir="auto" title={file.fileName}>{file.fileName}</b>
        <small><bdi className="tf-keep">{formatBytes(file.bytes, locale)}</bdi>{file.uploader && <> · <bdi>{pn(file.uploader.name)}</bdi></>} · <bdi className="tf-keep">{date(file.createdAt, true)}</bdi></small>
        {failed && <small className="tf-up-err">{failed}</small>}
      </div>
      {asking ? (
        <span className="tf-ask">
          <span>{t("removeAsk")}</span>
          <button type="button" className="pm-btn st-sm st-danger" onClick={() => void remove()} disabled={busy} aria-busy={busy}>{t("removeYes")}</button>
          <button type="button" className="pm-btn pm-ghost st-sm" onClick={() => setAsking(false)} disabled={busy}>{tb("cancel")}</button>
        </span>
      ) : (
        <span className="tf-acts">
          {file.downloadUrl && <a className="tf-act" href={file.downloadUrl} onClick={download} aria-label={t("downloadFile", { name: file.fileName })} title={t("download")}>{DOWNLOAD}</a>}
          {canRemove && <button type="button" className="tf-act is-danger" onClick={() => setAsking(true)} aria-label={t("removeFile", { name: file.fileName })} title={t("remove")}>{TRASH}</button>}
        </span>
      )}
    </li>
  );
}
