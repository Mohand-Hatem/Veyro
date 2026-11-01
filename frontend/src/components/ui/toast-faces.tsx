// The toast icons: Veyro's character (the preset avatars' skin, ink outline and bun) with one expression per kind,
// and a small badge with the symbol, so the meaning never rests on the face or the colour alone. Motion lives in toast.css.
const INK = "#18181B";
const SKIN = "#FBE5D6";

function Face({ kind, children, badge }: { kind: "ok" | "err" | "info"; children: React.ReactNode; badge: React.ReactNode }) {
  return (
    <svg className={`vt-face is-${kind}`} viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
      {/* the badge overlaps the disc's edge, like a notification badge; toast.css lets the svg overflow */}
      <g className="vt-head">
        <circle cx="20" cy="8.6" r="4" fill={INK} />
        <circle cx="20" cy="22" r="11" fill={SKIN} stroke={INK} strokeWidth="2" />
        <path d="M9.2 21C8.7 14 13.6 10.8 20 10.8S31.3 14 30.8 21C28.8 17.2 25 15.2 20 15.2S11.2 17.2 9.2 21z" fill={INK} />
        {children}
      </g>
      <g transform="translate(33 33) scale(1.1) translate(-32 -32)">
        <circle cx="32" cy="32" r="6.6" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" />
        {badge}
      </g>
    </svg>
  );
}

const line = { fill: "none", stroke: INK, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Happy: eyes closed in a smile, an open grin, warm cheeks. */
export const OkFace = () => (
  <Face kind="ok" badge={<path d="M29 32.2l2 2 4-4.2" {...line} stroke="#2E7D32" strokeWidth={2} />}>
    <path d="M14.2 23.4q1.9-2.4 3.8 0M22 23.4q1.9-2.4 3.8 0" {...line} />
    <path d="M15.8 26.6Q20 31.4 24.2 26.6Z" fill={INK} />
    <circle cx="13.6" cy="26.4" r="1.3" fill="#F4A6A0" />
    <circle cx="26.4" cy="26.4" r="1.3" fill="#F4A6A0" />
  </Face>
);

/** Worried: brows lifted in the middle, round eyes, a small "o", a drop of sweat. */
export const ErrorFace = () => (
  <Face kind="err" badge={<path d="M29.6 29.6l4.8 4.8M34.4 29.6l-4.8 4.8" {...line} stroke="#B4381E" strokeWidth={2} />}>
    <path d="M13.8 20.2l3.9-1.4M26.2 20.2l-3.9-1.4" {...line} />
    <circle cx="16.2" cy="23.6" r="1.5" fill={INK} />
    <circle cx="23.8" cy="23.6" r="1.5" fill={INK} />
    <circle cx="20" cy="28.2" r="1.7" fill={INK} />
    <path d="M29.4 14.6q2.2 3.1 0 4.5-2.2-1.4 0-4.5z" fill="#9CCBFF" stroke={INK} strokeWidth="1" />
  </Face>
);

/** Thinking: one brow up, eyes looking aside, a flat mouth. */
export const InfoFace = () => (
  <Face kind="info" badge={<><circle cx="32" cy="29.3" r="1.1" fill="#C2410C" /><path d="M32 31.8v3.4" {...line} stroke="#C2410C" strokeWidth={2} /></>}>
    <path d="M13.8 19.8q2-1.8 4 0M22.2 20.4h3.8" {...line} />
    <circle cx="17.2" cy="23.2" r="1.5" fill={INK} />
    <circle cx="25" cy="23.2" r="1.5" fill={INK} />
    <path d="M17.2 28.2h5.2" {...line} />
  </Face>
);
