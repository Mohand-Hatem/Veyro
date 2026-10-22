import Image from "next/image";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import "@/components/dashboard/illustration.css";
import "./loader.css";

// Loading scene from screens/shared/loading.html: a clerk files project folders into a pigeonhole shelf.
// The shelf is the workspace being assembled; folders fly in from the tray one after another, so it always looks busy.
// Pure CSS motion, no text inside the picture, so nothing in the SVG needs translating.
const FOLDER = "M0 12 a8 8 0 0 1 8 -8 h16 l8 10 h24 a8 8 0 0 1 8 8 v36 a8 8 0 0 1 -8 8 h-48 a8 8 0 0 1 -8 -8 z";
const KINDS = ["a", "b", "c", "d"] as const;
const TRAY = { x: 70, y: 330 }; // where every folder starts its flight
const CAPTIONS = ["cap1", "cap2", "cap3"] as const;

function Folder({ kind, style }: { kind: (typeof KINDS)[number]; style?: CSSProperties }) {
  return (
    <g className={`ld-f ${kind}`} style={style}>
      <path className="ld-fb" d={FOLDER} />
      <rect className="il-bar" x="12" y="30" width="30" height="5" rx="2.5" />
      <rect className="il-bar" x="12" y="40" width="20" height="5" rx="2.5" />
    </g>
  );
}

// Nine pigeonholes, filled from the bottom row up.
const SLOTS = Array.from({ length: 9 }, (_, i) => {
  const r = 2 - Math.floor(i / 3), c = i % 3;
  return { i, kind: KINDS[i % 4], x: 258 + 92 * c, y: 90 + 98 * r, hole: { x: 250 + 92 * c, y: 82 + 98 * r } };
});

// The empty pigeonholes, top row first.
const HOLES = SLOTS.map((s) => s.hole).sort((a, b) => a.y - b.y || a.x - b.x);

function Scene() {
  return (
    <svg viewBox="0 0 560 460" aria-hidden="true" focusable="false">
      <g className="il-dots"><path d="M104 330 C130 280 170 200 226 172" /><path d="M127 104 C160 86 200 82 238 96" /></g>
      <rect className="il-paper il-line" x="234" y="64" width="296" height="312" rx="18" />
      <rect className="il-soft" x="250" y="376" width="40" height="12" rx="4" /><rect className="il-soft" x="474" y="376" width="40" height="12" rx="4" />
      {HOLES.map((h) => <rect key={`h${h.x}-${h.y}`} className="il-slot" x={h.x} y={h.y} width="80" height="84" rx="10" />)}
      {SLOTS.map((s) => (
        <g key={`f${s.i}`} transform={`translate(${s.x} ${s.y})`}>
          <Folder kind={s.kind} style={{ "--i": s.i, "--dx": `${TRAY.x - s.x}px`, "--dy": `${TRAY.y - s.y}px` } as CSSProperties} />
        </g>
      ))}
      <path className="il-arm-o" d="M90 272 L70 302 L66 330" /><path className="il-arm-f" d="M90 272 L70 302 L66 330" />
      <path className="il-body" d="M58 362 C58 292 86 252 120 252 C154 252 182 292 182 362 Z" />
      <polygon className="il-emblem" points="120,272 133,279.5 133,294.5 120,302 107,294.5 107,279.5" />
      <rect className="il-neck" x="112" y="232" width="16" height="22" rx="6" />
      <circle className="il-head" cx="120" cy="200" r="34" />
      <path className="il-hair" d="M86 196 C84 160 108 150 124 152 C146 154 158 172 154 198 C148 184 138 176 122 176 C108 176 94 182 86 196 Z" />
      <circle className="ld-gl" cx="108" cy="204" r="9" /><circle className="ld-gl" cx="134" cy="204" r="9" /><path className="ld-gl" d="M117 204 h8" />
      <circle className="il-eye" cx="108" cy="204" r="2" /><circle className="il-eye" cx="134" cy="204" r="2" />
      <path className="il-face" d="M111 222 q9 7 18 0" />
      <g className="ld-arm">
        <path className="il-arm-o" d="M152 272 L196 260 L224 238" /><path className="il-arm-f" d="M152 272 L196 260 L224 238" />
        <g className="ld-hold"><g transform="translate(206 196) scale(0.56)"><Folder kind="b" style={{ opacity: 1, animation: "none" }} /></g></g>
        <circle className="il-fist" cx="226" cy="234" r="12" />
      </g>
      <g transform="translate(30 318) rotate(-5)"><Folder kind="c" style={{ opacity: 1, animation: "none" }} /></g>
      <g transform="translate(92 322) rotate(6)"><Folder kind="a" style={{ opacity: 1, animation: "none" }} /></g>
      <rect className="ld-tray" x="22" y="352" width="168" height="62" rx="12" /><rect className="il-bar" x="40" y="376" width="70" height="6" rx="3" /><rect className="il-bar" x="40" y="390" width="44" height="6" rx="3" />
      <g className="il-float d2">
        <rect className="il-paper il-line" x="26" y="34" width="136" height="36" rx="18" /><circle className="il-brandfill" cx="46" cy="52" r="9" />
        <rect x="42" y="52" width="8" height="6.5" rx="1.5" fill="#fff" /><path d="M43.5 52 v-2.6 a2.5 2.5 0 0 1 5 0 v2.6" fill="none" stroke="#fff" strokeWidth="1.6" />
        <rect className="il-bar" x="64" y="46" width="80" height="5" rx="2.5" /><rect className="il-bar" x="64" y="56" width="50" height="5" rx="2.5" />
      </g>
      <g className="il-float d3">
        <rect className="il-paper il-line" x="310" y="402" width="214" height="40" rx="20" /><circle className="il-tick-c" cx="334" cy="422" r="10" />
        <path className="il-tick" d="M329.5 422 l3.4 3.4 l6 -6.6" /><rect className="il-bar" x="352" y="414" width="130" height="5" rx="2.5" /><rect className="il-bar" x="352" y="425" width="84" height="5" rx="2.5" />
      </g>
      <g className="il-float d3">
        <circle className="il-paper il-line" cx="100" cy="112" r="27" />
        <circle cx="100" cy="112" r="15" fill="none" stroke="var(--il-track)" strokeWidth="5" />
        <circle className="ld-ring" cx="100" cy="112" r="15" fill="none" stroke="var(--il-brand)" strokeWidth="5" strokeLinecap="round" strokeDasharray="94.25" strokeDashoffset="31.4" transform="rotate(-90 100 112)" />
      </g>
    </svg>
  );
}

/**
 * The illustrated loading state. `page` fills a content area, `card` fits one card or panel, `full` takes the whole screen.
 * Lists that already know their shape keep their skeleton rows; this is for a screen that has nothing to show yet.
 */
export function Loader({ size = "page", label }: { size?: "page" | "card" | "full"; label?: string }) {
  const t = useTranslations("Loader");
  const bold = { b: (chunks: React.ReactNode) => <b>{chunks}</b> };
  return (
    <div className={`il-scene ld${size === "page" ? "" : ` ld-${size}`}`} role="status" aria-busy="true">
      <span className="sr-only">{label ?? t("label")}</span>
      {size === "full" && <span className="ld-brand" aria-hidden="true"><Image src="/logo.png" alt="" width={36} height={36} />Veyro</span>}
      <div className="il-illu"><Scene /></div>
      {/* captions are decorative: a screen reader hears the single status label above, not a changing line every three seconds */}
      <div className="ld-caps" aria-hidden="true">
        {CAPTIONS.map((k, n) => <p key={k} className="ld-cap" style={{ "--k": n } as CSSProperties}>{t.rich(k, bold)}</p>)}
      </div>
      <span className="ld-dots" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}
