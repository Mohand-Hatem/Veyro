import type { SVGProps } from "react";

// Ported from screens/groups/02-auth-onboarding/verify-email.html (decorative scene; text inside is illustration only).
export function SceneB(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 560 460" role="img" aria-label="A team member working on a laptop while a shield with a check mark protects the account; a verification code, a password strength meter and an audit log entry float around it" {...props}>
          
          <g className="il-dots"><path d="M262 304 C292 294 302 270 318 246"/><path d="M270 70 C274 108 270 130 264 150"/><path d="M200 84 C222 70 236 60 246 52"/><path d="M468 70 C470 90 462 110 448 130"/></g>

          
          <g className="il-arm il2-wave"><path className="il-arm-o" d="M206 236 L238 200 L250 170"/><path className="il2-arm-f" d="M206 236 L238 200 L250 170"/><circle className="il-fist" cx="252" cy="158" r="12"/></g>
          <path className="il2-body" d="M112 268 C112 218 136 200 165 200 C194 200 218 218 218 268 Z"/>
          <rect className="il-neck" x="157" y="186" width="16" height="22" rx="6"/>
          <circle className="il-head" cx="165" cy="152" r="36"/>
          <circle className="il-hair" cx="168" cy="100" r="15"/>
          <path className="il-hair" d="M127 150 C123 110 149 100 167 102 C191 104 207 124 203 152 C197 136 185 124 169 124 C153 124 137 132 127 150 Z"/>
          <path className="il-hair" d="M128 150 C120 170 125 188 138 194 L142 170 Z"/>
          <path className="il-hair" d="M202 152 C209 172 204 190 192 196 L188 172 Z"/>
          <path className="il-face" d="M139 156 q6 5 12 0 M161 156 q6 5 12 0 M147 172 q10 8 20 0"/>

          
          <rect className="il-paper il-line" x="68" y="252" width="194" height="122" rx="12"/>
          <polygon className="il2-hex" points="165,292 183,302 183,324 165,334 147,324 147,302"/>
          <polygon className="il2-hex-i" points="165,303 174,308 174,318 165,323 156,318 156,308"/>
          <rect className="il-card il2-base" x="40" y="372" width="250" height="16" rx="8"/>

          
          <g className="il2-shield">
            <path className="il-paper il-line" d="M400 104 C436 128 470 134 490 134 C490 236 460 308 400 346 C340 308 310 236 310 134 C330 134 364 128 400 104 Z"/>
            <path className="il2-shield-i" d="M400 124 C428 143 454 148 470 148 C470 228 446 288 400 320 C354 288 330 228 330 148 C346 148 372 143 400 124 Z"/>
            <circle className="il2-pulse" cx="400" cy="226" r="30"/>
            <circle className="il2-check-c" cx="400" cy="226" r="30"/>
            <path className="il2-tick" d="M386 226 l10 10 l20 -22"/>
          </g>

          
          <g className="il2-card il2-c1">
            <rect className="il-paper il-line" x="24" y="12" width="176" height="76" rx="14"/>
            <text className="il-t3" x="38" y="36">Verification code</text>
            <g className="il2-otp">
              <rect x="38" y="46" width="22" height="30" rx="6"/><rect x="64" y="46" width="22" height="30" rx="6"/><rect x="90" y="46" width="22" height="30" rx="6"/>
              <rect x="116" y="46" width="22" height="30" rx="6"/><rect x="142" y="46" width="22" height="30" rx="6"/><rect className="il2-otp-on" x="168" y="46" width="22" height="30" rx="6"/>
              <text x="49" y="67">4</text><text x="75" y="67">8</text><text x="101" y="67">2</text><text x="127" y="67">9</text><text x="153" y="67">1</text>
            </g>
          </g>

          
          <g className="il2-card il2-c2">
            <rect className="il-paper il-line" x="244" y="20" width="54" height="38" rx="8"/>
            <path className="il-line" d="M246 24 l25 19 l25 -19"/>
          </g>

          
          <g className="il2-card il2-c3">
            <rect className="il-paper il-line" x="344" y="14" width="196" height="58" rx="14"/>
            <text className="il-t3" x="358" y="36">Password strength</text>
            <rect className="il2-bar on" x="358" y="48" width="38" height="7" rx="3.5"/><rect className="il2-bar on" x="400" y="48" width="38" height="7" rx="3.5"/><rect className="il2-bar on" x="442" y="48" width="38" height="7" rx="3.5"/><rect className="il2-bar" x="484" y="48" width="38" height="7" rx="3.5"/>
          </g>

          
          <g className="il2-card il2-c4">
            <rect className="il-paper il-line" x="316" y="376" width="218" height="42" rx="21"/>
            <circle className="il2-check-c" cx="341" cy="397" r="10"/>
            <path className="il-tick" d="M336.5 397 l3.4 3.4 l6 -6.6"/>
            <text className="il-t3" x="360" y="402">Audit logged · just now</text>
          </g>
        </svg>
  );
}
