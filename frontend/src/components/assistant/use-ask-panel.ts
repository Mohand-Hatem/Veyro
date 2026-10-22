"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Open state of the quick-ask drawer, with its keyboard behaviour: Ctrl/⌘+J toggles it, Esc closes it, and closing puts the focus back where it was.
 * Opening marks the AI queries stale, so a drawer that stayed mounted shows what changed elsewhere (a conversation on the full page, a spent message).
 */
export function useAskPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback((from?: HTMLElement | null) => {
    opener.current = from ?? (document.activeElement as HTMLElement | null);
    void qc.invalidateQueries({ queryKey: ["ai"] });
    setOpen(true);
  }, [qc]);
  const hide = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); if (open) hide(); else show(); }
      else if (e.key === "Escape" && open) hide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show, hide]);

  return { open, show, hide };
}
