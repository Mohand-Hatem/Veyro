import type { SVGProps } from "react";

// Ported from screens/groups/02-auth-onboarding/login.html (decorative scene; text inside is illustration only).
export function SceneA(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 560 460" role="img" aria-label="A team member celebrating in front of a Kanban board, with an Owner, an Admin and a Member connected to the workspace" {...props}>
          
          <g className="il-dots"><path d="M100 140 C130 200 160 250 180 296"/><path d="M474 222 C440 262 410 292 384 316"/><path d="M502 148 C470 190 410 230 386 266"/></g>
          
          <path className="il-curl il-curl-a" d="M172 146 C150 120 120 110 124 80 C128 52 168 50 164 78 C161 98 138 96 142 78"/>
          <path className="il-curl il-curl-a" d="M388 146 C410 120 440 110 436 80 C432 52 392 50 396 78 C399 98 422 96 418 78"/>
          <path className="il-curl il-curl-b" d="M184 126 C206 62 354 62 376 126"/>

          
          <g className="il-arm il-arm-l"><path className="il-arm-o" d="M238 238 L192 202 L174 170"/><path className="il-arm-f" d="M238 238 L192 202 L174 170"/><circle className="il-fist" cx="170" cy="160" r="13"/></g>
          <g className="il-arm il-arm-r"><path className="il-arm-o" d="M322 238 L368 202 L386 170"/><path className="il-arm-f" d="M322 238 L368 202 L386 170"/><circle className="il-fist" cx="390" cy="160" r="13"/></g>
          <path className="il-body" d="M222 310 C222 236 248 202 280 202 C312 202 338 236 338 310 Z"/>
          <polygon className="il-emblem" points="280,222 295,231 295,249 280,258 265,249 265,231"/>
          <rect className="il-neck" x="272" y="184" width="16" height="22" rx="6"/>
          <circle className="il-head" cx="280" cy="152" r="36"/>
          <path className="il-hair" d="M242 150 C238 110 264 100 282 102 C306 104 322 124 318 152 C312 136 300 124 284 124 C268 124 252 132 242 150 Z"/>
          <path className="il-hair" d="M243 150 C235 170 240 188 253 194 L257 170 Z"/>
          <path className="il-hair" d="M317 152 C324 172 319 190 307 196 L303 172 Z"/>
          <path className="il-face" d="M254 156 q6 5 12 0 M276 156 q6 5 12 0 M262 172 q10 8 20 0"/>

          
          <g className="il-board">
            <rect className="il-paper il-line" x="176" y="268" width="208" height="140" rx="16"/>
            <g className="il-lbl"><text x="192" y="292">To do</text><text x="262" y="292">Doing</text><text x="330" y="292">Done</text></g>
            <rect className="il-card" x="190" y="302" width="56" height="28" rx="6"/><rect className="il-bar" x="198" y="311" width="36" height="4" rx="2"/><rect className="il-bar" x="198" y="319" width="22" height="4" rx="2"/>
            <rect className="il-card" x="190" y="338" width="56" height="28" rx="6"/><rect className="il-bar" x="198" y="347" width="30" height="4" rx="2"/><rect className="il-bar" x="198" y="355" width="38" height="4" rx="2"/>
            <rect className="il-card il-live" x="258" y="302" width="56" height="28" rx="6"/><rect className="il-bar" x="266" y="311" width="38" height="4" rx="2"/><rect className="il-bar" x="266" y="319" width="24" height="4" rx="2"/>
            <rect className="il-card" x="326" y="302" width="44" height="28" rx="6"/><circle className="il-tick-c" cx="340" cy="316" r="7"/><path className="il-tick" d="M336.5 316 l2.6 2.6 l4.6 -5"/>
          </g>

          
          <g className="il-av il-av1"><circle className="il-av-c" cx="72" cy="120" r="30"/><path className="il-hair" d="M44 114 C46 88 98 88 100 114 C90 104 54 104 44 114 Z"/><circle className="il-eye" cx="62" cy="124" r="2.4"/><circle className="il-eye" cx="82" cy="124" r="2.4"/><path className="il-face" d="M62 136 q10 8 20 0"/><rect className="il-chip" x="40" y="156" width="64" height="22" rx="11"/><text className="il-chip-t" x="72" y="171">Owner</text></g>
          <g className="il-av il-av2"><circle className="il-av-c" cx="486" cy="206" r="30"/><path className="il-hair" d="M458 200 C460 174 512 174 514 200 C504 190 468 190 458 200 Z"/><circle className="il-eye" cx="476" cy="210" r="2.4"/><circle className="il-eye" cx="496" cy="210" r="2.4"/><path className="il-face" d="M476 222 q10 8 20 0"/><rect className="il-chip" x="450" y="242" width="72" height="22" rx="11"/><text className="il-chip-t" x="486" y="257">Member</text></g>
          <g className="il-av il-av3"><circle className="il-av-c" cx="508" cy="92" r="26"/><path className="il-hair" d="M484 86 C486 64 530 64 532 86 C524 78 492 78 484 86 Z"/><circle className="il-eye" cx="500" cy="96" r="2.2"/><circle className="il-eye" cx="516" cy="96" r="2.2"/><path className="il-face" d="M500 106 q8 6 16 0"/><rect className="il-chip" x="478" y="124" width="60" height="22" rx="11"/><text className="il-chip-t" x="508" y="139">Admin</text></g>

          
          <g className="il-pcard">
            <rect className="il-paper il-line" x="36" y="326" width="192" height="104" rx="16"/>
            <text className="il-t1" x="54" y="356">Auth Revamp</text>
            <text className="il-t2" x="54" y="376">10 tasks</text>
            <rect className="il-pill" x="54" y="388" width="72" height="26" rx="13"/><text className="il-pill-t" x="90" y="405">Project</text>
            <circle className="il-ring-bg" cx="188" cy="384" r="17"/>
            <circle className="il-ring" cx="188" cy="384" r="17" transform="rotate(-90 188 384)"/>
            <text className="il-ring-t" x="188" y="387">68%</text>
          </g>

          
          <g className="il-ai">
            <rect className="il-paper il-line" x="318" y="400" width="206" height="40" rx="20"/>
            <path className="il-spark" d="M342 412 l2.6 6.4 l6.4 2.6 l-6.4 2.6 l-2.6 6.4 l-2.6 -6.4 l-6.4 -2.6 l6.4 -2.6 z"/>
            <text className="il-t3" x="358" y="425">AI proposes · you confirm</text>
          </g>
        </svg>
  );
}
