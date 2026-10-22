"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { initBento } from "./bento-engine.js";
import "./magic-bento.css";

const KEYS = ["b1_t", "b1_d", "b2_t", "b2_d", "b3_t", "b3_d", "b4_t", "b4_d", "b5_t", "b5_d", "b6_t", "b6_d", "v_this_sprint", "v_per_week", "v_moved", "v_sw1", "v_sw2"];

/** The features grid of the landing page. The grid and its effects are built by the engine in bento-engine.js, so React only mounts it and keeps its text and theme in step. */
export function MagicBento() {
  const t = useTranslations("Landing");
  const { resolvedTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const theme = useRef<"light" | "dark">("light"); // read by the engine when it (re)starts

  useEffect(() => {
    theme.current = resolvedTheme === "dark" ? "dark" : "light";
    ref.current?.setAttribute("data-theme", theme.current);
  }, [resolvedTheme]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    return initBento(root, { theme: theme.current, texts: Object.fromEntries(KEYS.map((k) => [k, t(k)])) });
  }, [t]); // a new language rebuilds the cards with the new text

  return <div id="magic-bento" ref={ref} aria-label={t("featuresLabel")} />;
}
