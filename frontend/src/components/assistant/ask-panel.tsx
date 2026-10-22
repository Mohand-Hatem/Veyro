"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { ChatComposer, ChatThread, useChat } from "./chat";
import "./ask-panel.css";

// SCR-AI-01 (Mode B: the workspace conversation) with the proposal cards of SCR-AI-02. Markup and class names follow screens/groups/05-ai-assistant/ai-panel.js (Parity Gate).
// A slide-over that is not modal: the page behind stays readable, Esc and the scrim close it, and Ctrl/⌘+J toggles it (see use-ask-panel.ts).
// The chat is loaded the first time the drawer opens and then kept, so a half-written question survives closing it.
export function AskPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [seen, setSeen] = useState(false);
  if (open && !seen) setSeen(true);
  return (
    <>
      <div className={`aip-scrim${open ? " is-open" : ""}`} onClick={onClose} />
      <aside className={`aip${open ? " is-open" : ""}`} id="aip" role="dialog" aria-modal="false" aria-labelledby="aip-t" tabIndex={-1} inert={!open}>
        {seen && <AskBody open={open} onClose={onClose} />}
      </aside>
    </>
  );
}

function AskBody({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Assistant");
  const { workspace } = useShell();
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const chat = useChat({ contextScope: "WORKSPACE", workspaceId: workspace?.id ?? "" }, { input, scroll });

  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open, input]);

  return (
    <>
      <header className="aip-head">
        <div className="aip-hrow">
          <span className="aip-spark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg></span>
          <h2 id="aip-t">{t("aipTitle")}</h2>
          <Link className="aip-full" href="/assistant" title={t("aipFullTitle")} onClick={onClose}>{t("aipFull")}</Link>
          <button type="button" className="aip-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="aip-hrow aip-sub">
          <span className="aip-ctx"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="2" /><rect x="14" y="3" width="7" height="11" rx="2" /></svg><span><span>{t("aipWs")}</span> · {workspace?.name}</span></span>
          <span className={chat.quotaClass}>{chat.quotaText}</span>
        </div>
      </header>
      <div className="aip-scroll" ref={scroll}>
        <ChatThread chat={chat} suggestions={[t("sg1"), t("sg2")]} />
      </div>
      <div className="aip-foot">
        <ChatComposer chat={chat} inputRef={input} inputId="aip-in" label={t("msgLabel")} icon={20} />
      </div>
    </>
  );
}
