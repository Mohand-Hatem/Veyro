// Parity Gate for the auth screens: compares a reference page in screens/ with its Next.js page.
// Run through the Playwright MCP (browser_run_code_unsafe, filename = this file) with:
//   npx http-server . -p 4173  (repo root)   and   the frontend on http://localhost:3000.
// Edit COMBOS to choose width / language / theme. Output: missing text, style diffs, layout offsets.
async (page) => {
  const PROTO = "http://localhost:4173/screens/groups/02-auth-onboarding/";
  const NEXT = "http://localhost:3000";
  const COMBOS = [1440, 390].flatMap((w) => ["en", "ar"].flatMap((lang) => ["light", "dark"].map((theme) => ({ w, lang, theme }))));
  const SAVE = false; // save screenshots into the scratchpad folder below
  const SP = "C:/Users/Mohand/AppData/Local/Temp/claude/c--Users-Mohand-Documents-GitHub-Veyro/7635f0fc-5822-4ab1-a211-f17f45aec4a8/scratchpad/";

  const PAGES = [
    { name: "login", proto: "login.html", next: "/login" },
    { name: "register", proto: "register.html", next: "/register" },
    { name: "verify-email", proto: "verify-email.html", next: "/verify-email?email=a%40b.io" },
    { name: "forgot-password", proto: "forgot-password.html", next: "/forgot-password" },
    { name: "reset-password", proto: "reset-password.html?token=abc", next: "/reset-password?token=abc" },
  ];
  // [label, selector in the reference page, selector in Next]. "text:..." finds the smallest element with that exact text.
  const COMMON = [
    ["page", "body", ".au"],
    ["brand", "a.au-brand", "a.au-brand"],
    ["theme-btn", "button.au-icon-btn", "button.au-icon-btn"],
    ["lang-btn", "button.au-icon-btn:nth-of-type(2), .js-lang-toggle", ".au-tools a.au-icon-btn"],
    ["back-link", ".au-back", ".au-back"],
    ["badge", ".au-badge", ".au-badge"],
    ["card-h1", ".au-card h1", ".au-card h1"],
    ["card-sub", ".au-sub", ".au-sub"],
    ["aside", ".au-side", ".au-side"],
    ["aside-caption", ".au-cap.is-on", ".au-cap.is-on"],
  ];
  const SAME = (label, sel) => [label, sel, sel];
  const BY_PAGE = {
    login: [SAME("oauth-google", '[data-oauth="google"]'), SAME("oauth-github", '[data-oauth="github"]'), ["or-divider", ".au-or", ".au-or"], SAME("email-label", "label[for=email]"), SAME("email", "#email"), SAME("password-label", "label[for=password]"), SAME("forgot-link", ".au-link"), SAME("password", "#password"), SAME("eye", ".au-eye"), SAME("submit", ".au-btn"), SAME("switch", ".au-switch"), SAME("switch-link", ".au-switch a")],
    register: [SAME("oauth-google", '[data-oauth="google"]'), SAME("or-divider", ".au-or"), SAME("name-label", "label[for=name]"), SAME("name", "#name"), SAME("email", "#email"), SAME("password", "#password"), SAME("eye", ".au-eye"), SAME("meter", ".au-meter"), SAME("rule", ".au-rules li"), SAME("submit", ".au-btn"), SAME("switch-link", ".au-switch a")],
    "verify-email": [SAME("email-b", ".au-email"), SAME("otp", ".au-otp"), SAME("otp-box", ".au-otp input"), SAME("submit", ".au-btn"), SAME("resend", ".au-resend"), SAME("switch", ".au-switch")],
    "forgot-password": [SAME("email", "#email"), SAME("submit", ".au-btn"), SAME("backlink", ".au-backlink")],
    "reset-password": [["new-password", "#password", "#newPassword"], ["confirm", "#confirm", "#confirm"], SAME("meter", ".au-meter"), SAME("submit", ".au-btn")],
  };
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow"];
  // Let entrance animations (600ms) and colour transitions (150ms) finish before measuring.
  const settle = () => page.waitForTimeout(1500);
  const SKIP_TEXT = /prototype|Back to site/i; // reference-only notes; "Back to site" is hidden on phones in both

  const measure = (args) => page.evaluate(({ list, props, skip }) => {
    const find = (sel) => {
      if (sel.startsWith("text:")) {
        const t = sel.slice(5);
        return [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0 && e.textContent.trim() === t)[0] || null;
      }
      const all = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; });
      return all[0] || null;
    };
    const out = {};
    for (const [label, sel] of list) {
      const el = find(sel);
      if (!el) { out[label] = null; continue; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const o = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      for (const p of props) o[p] = p === "fontFamily" ? cs[p].split(",")[0].replace(/["']/g, "").trim() : cs[p];
      out[label] = o;
    }
    const texts = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode, el = n.parentElement;
      if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) || el.closest("svg")) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t && !new RegExp(skip, "i").test(t)) texts.add(t);
    }
    out.__texts = [...texts];
    return out;
  }, args);

  const report = {};
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const pg of PAGES) {
      const key = `${pg.name} ${c.w} ${c.lang} ${c.theme}`;
      // reference page
      await page.goto(PROTO + pg.proto, { waitUntil: "load" });
      await page.evaluate((c) => { localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle"); // the reference remembers the language itself
      await settle();
      const list = [...COMMON, ...(BY_PAGE[pg.name] || [])];
      const A = await measure({ list: list.map((l) => [l[0], l[1]]), props: PROPS, skip: SKIP_TEXT.source });
      if (SAVE) await page.screenshot({ path: `${SP}p-${pg.name}-${c.w}-${c.lang}-${c.theme}-proto.png` });
      // next page
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      await page.evaluate((c) => localStorage.setItem("theme", c.theme), c);
      await page.goto(NEXT + "/" + c.lang + pg.next, { waitUntil: "networkidle" });
      await settle();
      const B = await measure({ list: list.map((l) => [l[0], l[2]]), props: PROPS, skip: SKIP_TEXT.source });
      if (SAVE) await page.screenshot({ path: `${SP}p-${pg.name}-${c.w}-${c.lang}-${c.theme}-next.png` });

      const diffs = [];
      for (const [label] of list) {
        const a = A[label], b = B[label];
        if (!a && !b) continue;
        if (!a) { diffs.push(`${label}: only in Next`); continue; }
        if (!b) { diffs.push(`${label}: MISSING in Next`); continue; }
        for (const p of PROPS) {
          if (p === "borderTopColor" && a.borderTopWidth === "0px" && b.borderTopWidth === "0px") continue; // no visible border
          if (a[p] !== b[p]) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
        }
        for (const p of ["x", "y", "w", "h"]) if (Math.abs(a[p] - b[p]) > 1) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
      }
      const missing = A.__texts.filter((t) => !B.__texts.includes(t));
      const extra = B.__texts.filter((t) => !A.__texts.includes(t));
      if (diffs.length || missing.length || extra.length) report[key] = { missing, extra, n: diffs.length, diffs: diffs.slice(0, 12) };
      report.__checked = (report.__checked || 0) + 1;
    }
  }
  return report;
}
