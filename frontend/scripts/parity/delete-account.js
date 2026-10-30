// Parity Gate for the "Delete my account" dialog on the Profile page (SCR-ACC-03, step G2b).
// Reference: the design board screens/groups/06-account-governance/delete-user.html (one static dialog per state). Next: the dialog opened from /{lang}/account/profile.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/delete-account.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// Seed: cd backend && npm run parity:seed-profile -- create (leo@acme.io is a member, mohand@acme.io owns "Acme Corp"); cleanup after.
// The board is static, so positions are compared relative to the dialog's own corner. Waiting and refused states are made in the app by holding or aborting the DELETE request.
async (page) => {
  const BOARD = "http://localhost:4173/screens/groups/06-account-governance/delete-user.html";
  const NEXT = "http://localhost:3000";
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{ w: 1440, lang: "en", theme: "light" }];
  const ONLY = CFG.states ?? null;
  const LIST = [
    "dlg|.pm", "form|.pm-form", "main|.pm-main", "head|.pm-head", "h2|.pm-head h2", "sub|.pm-head p", "x|.pm-x",
    "list|.du-list", "li1|.du-list li:nth-child(1)", "li4|.du-list li:nth-child(4)", "alert|.pm-alert:not([hidden])",
    "f-pw|.pm-f", "l-pw|.pm-f label", "in-pw|.pm-f input", "err-pw|.pm-err:not([hidden])", "hint|.du-hint", "hint-a|.du-hint a",
    "block|.du-block", "block-b|.du-block b", "block-p|.du-block p",
    "foot|.pm-foot", "cancel|.pm-foot .pm-ghost", "go|.pm-foot .st-danger", "go-link|.pm-foot a.pm-go", "spin|.pm-spin",
    "side|.pm-side", "illu|.il-illu", "svg|.il-illu svg", "caps|.il-caps", "cap-on|.il-cap.is-on", "pager|.il-pager", "dot-on|.il-pager button.is-on",
  ].map((s) => s.split("|"));
  // card = which board card shows the state (1-based position inside #cards: 1 is the danger card on the Profile page)
  const STATES = [
    { name: "opened", persona: "leo", card: 2 },
    { name: "typed", persona: "leo", card: 3, pw: "Passw0rd!long" },
    { name: "deleting", persona: "leo", card: 4, pw: "Passw0rd!long", hold: true },
    { name: "wrong", persona: "leo", card: 5, pw: "wrong-pass", submit: true },
    { name: "owner", persona: "mohand", card: 6 },
    { name: "refused", persona: "leo", card: 7, pw: "Passw0rd!long", abort: true },
  ];
  const PERSONA = { leo: "leo@acme.io", mohand: "mohand@acme.io" };
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props, scope }) => {
    const root = document.querySelector(scope);
    const base = root.getBoundingClientRect();
    const find = (sel) => (sel === ".pm" ? root : [...root.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })[0] || null);
    const out = {};
    for (const [label, sel] of list) {
      const el = find(sel);
      if (!el) { out[label] = null; continue; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const o = { x: Math.round(r.x - base.x), y: Math.round(r.y - base.y), w: Math.round(r.width), h: Math.round(r.height) };
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
      if (t) texts.push(t);
    }
    out.__texts = texts;
    out.__goDisabled = root.querySelector(".pm-foot .st-danger")?.disabled ?? null;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(`${BOARD}?theme=${c.theme}&lang=${c.lang}`, { waitUntil: "load" });
      await wait(800);
      const A = await measure({ list: LIST, props: PROPS, scope: `#cards > .bx-card:nth-child(${st.card}) .pm` });

      await page.context().clearCookies();
      await page.unroute("**/api/v1/users/me").catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.persona]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate(async (c) => { await fetch("/api/v1/users/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: c.lang === "ar" ? "AR" : "EN", theme: c.theme.toUpperCase() }) }); localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/account/profile`, { waitUntil: "networkidle" });
      await page.waitForSelector("#pf-dz-btn", { timeout: 60000 });
      await wait(1500);
      // A held request must be aborted, never released: unrouting would send it on and really delete the person.
      let held = null;
      if (st.hold) await page.route("**/api/v1/users/me", (r) => (r.request().method() === "DELETE" ? (held = r, undefined) : r.continue()));
      if (st.abort) await page.route("**/api/v1/users/me", (r) => (r.request().method() === "DELETE" ? r.abort() : r.continue()));
      await page.click("#pf-dz-btn");
      await page.waitForSelector("dialog[open]", { timeout: 15000 });
      await wait(900);
      if (st.pw) await page.fill("dialog[open] #du-pw", st.pw);
      if (st.hold || st.submit || st.abort) { await page.click("dialog[open] #du-go"); await wait(st.submit ? 3500 : 1200); }
      await wait(400);
      const B = await measure({ list: LIST, props: PROPS, scope: "dialog[open]" });
      await held?.abort();
      await page.unroute("**/api/v1/users/me").catch(() => {});

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
      report[key] = { goDisabled: [A.__goDisabled, B.__goDisabled], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 50) };
    }
  }
  return report;
}
