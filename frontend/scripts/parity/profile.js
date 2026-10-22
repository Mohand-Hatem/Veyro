// Parity Gate for the Profile page (SCR-ACC-01 / SCR-ACC-02), content area only.
// Reference: screens/groups/06-account-governance/profile.html (role + scenario). Next: /{lang}/account/profile.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/profile.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed is the reference's own three people (mohand/sarah/leo @acme.io) and footprint (backend/tmp-seed61.ts); it refuses to run if they exist.
// Known, deliberate text difference: the Preferences note (the reference promises the choice follows you to every device; the app does not do that yet).
// The saved preferences of the signed-in user are set through PATCH /users/me to match the combo, because the reference shows the device's own.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/06-account-governance/profile.html";
  const NEXT = "http://localhost:3000";
  const PERSONA = { owner: "mohand@acme.io", admin: "sarah@acme.io", member: "leo@acme.io" };
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("crumbs", ".bd-crumbs"), SAME("crumb-a", ".bd-crumbs a"), SAME("crumb-b", ".bd-crumbs b"),
    SAME("hero", ".pf-hero"), SAME("hero-l", ".pf-hero-l"), SAME("avatar", "#pf-avatar"), SAME("av-t", "#pf-av-t"), SAME("av-i", ".pf-avatar i"), SAME("id-t", ".pf-id-t"), SAME("name-h", "#pf-name-h"), SAME("mail", ".pf-mail"), SAME("mail-s", "#pf-mail"), SAME("ver", "#pf-ver"), SAME("since", "#pf-since"), SAME("hint", ".pf-hint"),
    SAME("ill", ".pf-ill"), SAME("ill-svg", ".pf-ill svg"), SAME("l-en", "#pfs-l-en"), SAME("l-ar", "#pfs-l-ar"), SAME("t-en", "#pfs-t-en"), SAME("t-ar", "#pfs-t-ar"), SAME("track", "#pfs-track"), SAME("knob", "#pfs-knob"), SAME("th-t", "#pfs-th"),
    SAME("cols", ".pf-cols"), SAME("col1", ".pf-col:nth-child(1)"), SAME("col2", ".pf-col:nth-child(2)"),
    SAME("pf-form", "#pf-form"), SAME("pf-h2", "#pf-edit-h"), SAME("pf-alert", "#pf-alert:not([hidden])"), SAME("f-name", "#pf-f-name"), SAME("l-name", "#pf-f-name label"), SAME("count", "#pf-count"), SAME("in-name", "#pf-name"), SAME("err-name", "#pf-name-e:not([hidden])"),
    SAME("l-email", "label[for=pf-email]"), SAME("email-h", "label[for=pf-email] + .pm-count"), SAME("in-email", "#pf-email"), SAME("pf-save", "#pf-save"),
    SAME("pw-form", "#pw-form"), SAME("pw-h", "#pw-h"), SAME("pw-note", "#pw-form .st-note"), SAME("pw-alert", "#pw-alert:not([hidden])"), SAME("pw-ok", "#pw-ok:not([hidden])"),
    SAME("l-cur", "#pw-f-cur label"), SAME("in-cur", "#pw-cur"), SAME("err-cur", "#pw-cur-e:not([hidden])"), SAME("l-new", "#pw-f-new label"), SAME("in-new", "#pw-new"), SAME("meter", "#pw-meter"), SAME("bars", ".pw-bars"), SAME("bar1", ".pw-bars i:nth-child(1)"), SAME("bar4", ".pw-bars i:nth-child(4)"), SAME("meter-t", "#pw-meter-t"), SAME("err-new", "#pw-new-e:not([hidden])"),
    SAME("l-conf", "#pw-f-conf label"), SAME("in-conf", "#pw-conf"), SAME("err-conf", "#pw-conf-e:not([hidden])"), SAME("pw-save", "#pw-save"),
    SAME("foot", ".pf-foot"), SAME("foot-h", "#pf-foot-h"), SAME("stats", "#pf-stats"), SAME("t1", "#pf-stats > div:nth-child(1)"), SAME("t1-d", "#pf-stats > div:nth-child(1) dd"), SAME("t1-t", "#pf-stats > div:nth-child(1) dt"), SAME("t4", "#pf-stats > div:nth-child(4)"), SAME("t4-d", "#pf-stats > div:nth-child(4) dd"), SAME("t5", "#pf-stats > div:nth-child(5)"), SAME("t5-d", "#pf-stats > div:nth-child(5) dd"),
    SAME("ws", "#pf-ws"), SAME("w1", ".pf-w:nth-child(1)"), SAME("w1-av", ".pf-w:nth-child(1) .pf-wav"), SAME("w1-n", ".pf-w:nth-child(1) .pf-wn"), SAME("w1-b", ".pf-w:nth-child(1) .pf-wn b"), SAME("w1-s", ".pf-w:nth-child(1) small"), SAME("w1-t", ".pf-w:nth-child(1) .pf-wt"), SAME("w1-p1", ".pf-w:nth-child(1) .ap-st:nth-child(1)"), SAME("w1-p2", ".pf-w:nth-child(1) .ap-st:nth-child(2)"), SAME("w2", ".pf-w:nth-child(2)"), SAME("w2-p1", ".pf-w:nth-child(2) .ap-st:nth-child(1)"),
    SAME("prefs", ".pf-prefs"), SAME("pref-h", "#pf-pref-h"), SAME("pref-n", ".pf-prefs .st-note"), SAME("pr1", ".pf-pr:nth-of-type(1)"), SAME("pr1-b", ".pf-pr:nth-of-type(1) b"), SAME("pr1-p", ".pf-pr:nth-of-type(1) p"), SAME("lang-seg", "#pf-lang"), SAME("lang-b1", "#pf-lang button:nth-child(1)"), SAME("lang-on", "#pf-lang [aria-checked=true]"),
    SAME("pr2", ".pf-pr:nth-of-type(2)"), SAME("theme-seg", "#pf-theme"), SAME("theme-b1", "#pf-theme button:nth-child(1)"), SAME("theme-on", "#pf-theme [aria-checked=true]"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
  ];
  // name = typed full name, nameSubmit = press Save, pw = [current, new, confirm], pwSubmit = press Change password
  const STATES = [
    { name: "full", role: "owner" },
    { name: "admin", role: "admin" },
    { name: "member", role: "member" },
    { name: "name-typed", role: "owner", nameText: "Mohand Abdelrahman Hatem" },
    { name: "name-err", role: "owner", nameText: "M", nameSubmit: true },
    { name: "pw-weak", role: "owner", pw: ["", "abc", ""] },
    { name: "pw-good", role: "owner", pw: ["", "Passw0rd!x", ""] },
    { name: "pw-strong", role: "owner", pw: ["", "Passw0rd!long-enough", ""] },
    { name: "pw-empty-submit", role: "owner", pwSubmit: true },
    { name: "pw-mismatch", role: "owner", pw: ["Passw0rd!long", "Passw0rd!new1", "Passw0rd!new2"], pwSubmit: true },
    { name: "pw-wrong", role: "owner", pw: ["wrong", "Passw0rd!new1", "Passw0rd!new1"], pwSubmit: true },
    { name: "error", role: "owner", scn: "error" },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props }) => {
    const root = document.querySelector(".ap-body");
    const find = (sel) => [...root.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })[0] || null;
    const out = {};
    for (const [label, sel] of list) {
      const el = find(sel);
      if (!el) { out[label] = null; continue; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const o = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      for (const p of props) o[p] = p === "fontFamily" ? cs[p].split(",")[0].replace(/["']/g, "").trim() : cs[p];
      out[label] = o;
    }
    const texts = [];
    for (const el of root.querySelectorAll("*")) {
      if (el.closest("svg") && el.tagName !== "text") continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden") continue;
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t && !/prototype/i.test(t)) texts.push(t);
    }
    out.__texts = texts;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st) => {
    if (st.nameText !== undefined) await page.fill("#pf-name", st.nameText);
    if (st.nameSubmit) { await page.click("#pf-save"); await wait(600); }
    if (st.pw) { await page.fill("#pw-cur", st.pw[0]); await page.fill("#pw-new", st.pw[1]); await page.fill("#pw-conf", st.pw[2]); }
    if (st.pwSubmit) { await page.click("#pw-save"); await wait(st.pw && st.pw[0] === "wrong" ? 7000 : 700); }
    await wait(400);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${st.role} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role: st.role, c });
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      if (st.scn) await page.selectOption("#pf-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2800);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      // the saved preferences follow the combo (the reference shows the device's own)
      await page.evaluate(async (c) => { await fetch("/api/v1/users/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: c.lang === "ar" ? "AR" : "EN", theme: c.theme.toUpperCase() }) }); localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const ERR = /\/api\/v1\/users\/me\/profile/;
      if (st.scn === "error") await page.route(ERR, (r) => r.abort());
      else await page.unroute(ERR).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/account/profile`, { waitUntil: "networkidle" });
      await page.waitForSelector(".pf-hero, .st-error", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2800);
      await act(st);
      const B = await measure({ list: LIST.map((l) => [l[0], l[2]]), props: PROPS });

      // After a refused submit each page scrolls to the focused field by a different amount, so compare positions relative to the hero.
      const shift = (st.pwSubmit || st.nameSubmit) && A.hero && B.hero ? A.hero.y - B.hero.y : 0;
      for (const k of Object.keys(B)) if (B[k] && typeof B[k].y === "number") B[k].y += shift;
      const diffs = [];
      for (const [label] of LIST) {
        const a = A[label], b = B[label];
        if (!a && !b) continue;
        if (!a) { diffs.push(`${label}: only in Next`); continue; }
        if (!b) { diffs.push(`${label}: MISSING in Next`); continue; }
        for (const p of PROPS) {
          if (p === "borderTopColor" && a.borderTopWidth === "0px" && b.borderTopWidth === "0px") continue;
          if (a[p] !== b[p]) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
        }
        for (const p of ["x", "y", "w", "h"]) if (Math.abs(a[p] - b[p]) > 1) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
      }
      const ta = A.__texts.map(mask), tb = B.__texts.map(mask);
      report[key] = { overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 50) };
    }
  }
  return report;
}
