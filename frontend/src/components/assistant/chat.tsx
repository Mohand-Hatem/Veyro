"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import {
  countdown, findConversation, proposalFailure, sendFailure,
  useAiConversations, useAiMessages, useAiQuota, useResolveProposal, useSendMessage,
  type AiMessage, type AiProposal, type ChatTarget,
} from "@/lib/ai";
import { initials } from "@/lib/dashboard";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "./assistant.css";

// The conversation behind both screens: the /assistant page (global knowledge) and the quick-ask drawer (one conversation per workspace).
// Markup and class names follow screens/groups/05-ai-assistant/ai-core.js (Parity Gate).

export const SPARK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>;

/** The two elements the controller steers (focus after a send, scroll to the newest message) are created by the screen and passed in, so the returned object holds plain data only. */
export type ChatRefs = { input: RefObject<HTMLTextAreaElement | null>; scroll: RefObject<HTMLDivElement | null> };

export function useChat(target: ChatTarget, refs: ChatRefs) {
  const t = useTranslations("Assistant");
  const { user, notify } = useShell();
  const quota = useAiQuota();
  const convs = useAiConversations();
  const conv = findConversation(convs.data, target);
  const thread = useAiMessages(conv?.id);
  const send = useSendMessage(conv, target, t("newConv"));

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<{ text: string; at: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const keyRef = useRef<string | null>(null); // kept after a gateway failure so the retry is not charged twice
  const wasBusy = useRef(false);
  const { input: inputRef, scroll: scrollRef } = refs;

  const q = quota.data;
  const max = q?.remaining === 0;
  const low = q?.remaining === 1;
  const busy = send.isPending;
  const resetsAt = q?.resetsAt;
  const refetchQuota = quota.refetch;

  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (resetsAt && n >= new Date(resetsAt).getTime()) { clearInterval(id); void refetchQuota(); } // the day turned over: ask for the new count
    }, 1000);
    return () => clearInterval(id);
  }, [resetsAt, refetchQuota]);
  useEffect(() => { if (wasBusy.current && !busy) inputRef.current?.focus(); wasBusy.current = busy; }, [busy, inputRef]);

  const messages: AiMessage[] = [
    ...(thread.data ?? []),
    ...(pending ? [{ id: "pending", senderRole: "USER" as const, content: pending.text, createdAt: pending.at }] : []),
  ];
  const shownCount = messages.length;
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [shownCount, busy, scrollRef]); // the newest message stays in view; typing in the box must not move the thread

  const autosize = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${Math.min(160, el.scrollHeight)}px`; };

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || busy || max) return;
    const key = (keyRef.current ??= crypto.randomUUID());
    setPending({ text, at: new Date().toISOString() });
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      await send.mutateAsync({ content: text, key });
      keyRef.current = null;
    } catch (err) {
      const failure = sendFailure(err);
      if (!failure.keepKey) keyRef.current = null;
      setDraft(text);
      notify(t(failure.key));
    } finally {
      setPending(null);
    }
  }

  return {
    conv, q, max, low, busy, now, draft, setDraft, messages, autosize, submit,
    me: user ? initials(user.name) : "",
    loaded: convs.isSuccess && (!conv || thread.isSuccess),
    failed: quota.isError || convs.isError,
    quotaText: q ? t("quota", { used: String(q.messagesUsed), total: String(q.dailyQuota) }) : " ",
    quotaClass: `ai-q${max ? " is-max" : low ? " is-low" : ""}`,
    clock: q ? countdown(q.resetsAt, now) : "--:--:--",
  };
}
export type Chat = ReturnType<typeof useChat>;

function ProposalCard({ p, busy, error, onConfirm, onReject, boardHref }: { p: AiProposal; busy: boolean; error: string; onConfirm: () => void; onReject: () => void; boardHref: string }) {
  const t = useTranslations("Assistant");
  const pl = p.proposedPayload;
  const tone = { PENDING: "", EXECUTED: "is-done", REJECTED: "is-no", FAILED: "is-no" }[p.status];
  return (
    <div className={`ai-pc${tone ? ` ${tone}` : ""}${busy ? " is-busy" : ""}`}>
      <div className="ai-pc-h">{SPARK}<b>{t("pcTitle")}</b></div>
      <p className="ai-pc-t">{pl.title}</p>
      <dl className="ai-pc-d">
        <div><dt>{t("pcProject")}</dt><dd><span className="ap-key">{p.project ? p.project.key : "—"}</span> {p.project ? p.project.name : ""}</dd></div>
        <div><dt>{t("pcPriority")}</dt><dd><span className={`pr pr-${pl.priority}`}>{t(`prio${pl.priority}`)}</span></dd></div>
      </dl>
      {p.status === "PENDING" ? (
        <div className="ai-pc-act">
          <button type="button" className="pm-btn pm-go st-sm" aria-busy={busy || undefined} disabled={busy} onClick={onConfirm}><span className="pm-spin" aria-hidden="true" /><span>{t("pcConfirm")}</span></button>
          <button type="button" className="pm-btn pm-ghost st-sm" disabled={busy} onClick={onReject}>{t("pcReject")}</button>
          <small>{t("pcFree")}</small>
        </div>
      ) : p.status === "EXECUTED" ? (
        <div className="ai-pc-res is-done"><b>{t("pcDone")}</b><a href={boardHref}>{t("pcOpen")}</a></div>
      ) : (
        <div className="ai-pc-res is-no"><b>{t("pcRejected")}</b></div>
      )}
      <p className="ai-pc-err" hidden={!error}>{error}</p>
    </div>
  );
}

/** The messages, the typing indicator, the proposal cards, and the empty state with its suggestions. */
export function ChatThread({ chat, suggestions }: { chat: Chat; suggestions: string[] }) {
  const t = useTranslations("Assistant");
  const tag = useLocale() === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const { workspace, notify } = useShell();
  const resolve = useResolveProposal(chat.conv?.id, workspace?.id);
  const [acting, setActing] = useState<string | null>(null);
  const [cardError, setCardError] = useState<Record<string, string>>({});

  const hm = (s: string) => new Date(s).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  async function act(p: AiProposal, action: "confirm" | "reject") {
    setActing(p.id);
    setCardError((e) => ({ ...e, [p.id]: "" }));
    try {
      await resolve.mutateAsync({ id: p.id, action });
      notify(t(action === "confirm" ? "pcDone" : "pcRejected"));
    } catch (err) {
      setCardError((e) => ({ ...e, [p.id]: t(proposalFailure(err)) }));
    } finally {
      setActing(null);
    }
  }

  return (
    <ol className="ai-list" aria-label={t("conversation")}>
      {chat.messages.length > 0 ? (
        <>
          {chat.messages.map((m) => {
            const mine = m.senderRole === "USER";
            return (
              <li key={m.id} className={`ai-m ${mine ? "is-user" : "is-bot"}`}>
                <span className="ai-av" aria-hidden="true">{mine ? chat.me : SPARK}</span>
                <div className="ai-b">
                  <div className="ai-bt"><b>{mine ? t("you") : t("bot")}</b><small>{hm(m.createdAt)}</small></div>
                  <p>{m.content}</p>
                  {m.proposal && <ProposalCard p={m.proposal} busy={acting === m.proposal.id} error={cardError[m.proposal.id] ?? ""} onConfirm={() => void act(m.proposal!, "confirm")} onReject={() => void act(m.proposal!, "reject")} boardHref={workspace && m.proposal.project ? `/w/${workspace.slug}/projects/${m.proposal.project.key}` : "#"} />}
                </div>
              </li>
            );
          })}
          {chat.busy && <li className="ai-m is-bot"><span className="ai-av" aria-hidden="true">{SPARK}</span><div className="ai-b"><div className="ai-dots" role="status" aria-label={t("typing")}><i /><i /><i /></div></div></li>}
        </>
      ) : chat.loaded && (
        <li className="ai-empty"><b>{t("emptyT")}</b><p>{t("emptyD")}</p><span className="ai-sg">{suggestions.map((s) => <button key={s} type="button" onClick={() => void chat.submit(s)}>{s}</button>)}</span></li>
      )}
    </ol>
  );
}

/** The daily-limit notice, a load error, the message box and the placeholder note. */
export function ChatComposer({ chat, inputRef, inputId, label, icon }: { chat: Chat; inputRef: ChatRefs["input"]; inputId: string; label: string; icon: number }): ReactNode {
  const t = useTranslations("Assistant");
  return (
    <>
      <div className="ai-max" role="status" hidden={!chat.max}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3 2" /></svg>
        <b>{t("maxT")}</b>
        <span><span>{t("maxD")}</span> <span className="ai-cd">{chat.clock}</span></span>
      </div>
      {chat.failed && <p className="ai-note" role="alert">{t("errGeneric")}</p>}
      <form className={`ai-comp${chat.max ? " is-max" : ""}`} autoComplete="off" onSubmit={(e: FormEvent) => { e.preventDefault(); void chat.submit(chat.draft); }}>
        <label className="ap-sr" htmlFor={inputId}>{label}</label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          maxLength={4000}
          placeholder={t("ph")}
          value={chat.draft}
          disabled={chat.max || chat.busy}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { chat.setDraft(e.target.value); chat.autosize(e.target); }}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void chat.submit(chat.draft); } }}
        />
        <button type="submit" className="ai-send" aria-label={t("send")} disabled={chat.max || chat.busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
      <p className="ai-note">{t("note")}</p>
    </>
  );
}
