"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SceneA } from "./scenea";
import { SceneB } from "./sceneb";
import "./auth-aside.css";

const SCENES = {
  a: { Scene: SceneA, label: "sceneA", caps: ["capA1", "capA2", "capA3"] },
  b: { Scene: SceneB, label: "sceneB", caps: ["capB1", "capB2", "capB3"] },
} as const;

// Decorative side panel (illustrated surface, design.md). Captions rotate unless the user prefers reduced motion.
export function AuthAside({ scene }: { scene: keyof typeof SCENES }) {
  const t = useTranslations("Auth");
  const { Scene, label, caps } = SCENES[scene];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % caps.length), 5500);
    return () => clearInterval(id);
  }, [caps.length]);

  return (
    <aside className="au-side" aria-label={t("highlights")}>
      <div className="au-links" aria-hidden="true" />
      <div className="au-illu">
        <Scene aria-label={t(label)} />
      </div>
      <div className="au-caps" aria-live="polite">
        {caps.map((key, i) => (
          <p key={key} className={`au-cap${i === active ? " is-on" : ""}`} aria-hidden={i !== active}>
            {t.rich(key, { b: (chunks) => <b>{chunks}</b> })}
          </p>
        ))}
      </div>
      <div className="au-dots" role="tablist" aria-label={t("highlights")}>
        {caps.map((key, i) => (
          <button key={key} type="button" role="tab" className={i === active ? "is-on" : ""} aria-selected={i === active} aria-label={t("highlight", { n: i + 1 })} onClick={() => setActive(i)} />
        ))}
      </div>
    </aside>
  );
}
