// Parity Gate for the Invite dialog (SCR-INVT-02) of Members & settings.
// Reference: screens/groups/03-workspace-dashboard/settings.html (the dialog opens from #st-invite). Next: /{lang}/w/{slug}/settings.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/settings-invite.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed must use the reference's own people and emails (mohand@acme.io, ...): it refuses to run if they exist. SEED.slug is stale after cleanup.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/settings.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"slug": "acme-eng-cskb8y"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  let seq = 0; // the done states create real invitations, so their emails must be new on every run and combo
  const nextRun = () => String(Date.now() % 100000 + (seq++ % 7) * 0).padStart(5, "0");
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("dlg", "dialog[open]"), SAME("form", ".pm-form"), SAME("main", ".pm-main"), SAME("view", ".iv-view:not([hidden])"), SAME("head", ".pm-head"), SAME("h2", ".pm-head h2"), SAME("sub", ".pm-head p"), SAME("x", ".pm-x"), SAME("alert", ".pm-alert:not([hidden])"),
    SAME("f-email", "#iv-f-email"), SAME("l-email", "#iv-f-email label"), SAME("in-email", "#iv-email"), SAME("err-email", "#iv-email-e:not([hidden])"),
    SAME("roles", ".iv-roles"), SAME("legend", ".iv-roles legend"), SAME("rgrid", ".iv-rgrid"), SAME("role1", ".iv-role:nth-child(1)"), SAME("role1-b", ".iv-role:nth-child(1) b"), SAME("role1-s", ".iv-role:nth-child(1) small"), SAME("role2", ".iv-role:nth-child(2)"),
    SAME("projects", "#iv-projects"), SAME("lrow", "#iv-projects .pm-lrow"), SAME("lbl", "#iv-proj-l"), SAME("all", "#iv-all"), SAME("plist", "#iv-plist"), SAME("p1", ".iv-p:nth-child(1)"), SAME("p1-k", ".iv-p:nth-child(1) .ap-key"), SAME("p1-b", ".iv-p:nth-child(1) b"), SAME("p4", ".iv-p:nth-child(4)"), SAME("p5", ".iv-p:nth-child(5)"), SAME("p5-s", ".iv-p:nth-child(5) small"), SAME("hint", "#iv-proj-h"), SAME("admin-note", "#iv-admin-note"),
    SAME("foot", ".pm-foot"), SAME("cancel", ".pm-foot .pm-ghost"), SAME("go", ".pm-foot .pm-go"),
    SAME("done-t", "#iv-done-t"), SAME("done-s", "#iv-done-s"), SAME("lbox", ".st-linkbox"), SAME("url", "#iv-url"), SAME("copy", "#iv-copy"), SAME("done-h", ".iv-view .pm-hint"), SAME("sum", "#iv-sum"), SAME("sum-b", "#iv-sum .st-badge"), SAME("sum-k", "#iv-sum .ap-key"), SAME("sum-n", "#iv-sum .st-note"),
    SAME("side", ".pm-side"), SAME("illu", ".pm-side .il-illu"), SAME("svg", ".pm-side svg"), SAME("pv-ws", "#iv-pv-ws"), SAME("pv-email", "#iv-pv-email"), SAME("pv-role", "#iv-pv-role rect"), SAME("pv-role-t", "#iv-pv-role-t"), SAME("pv-tags", "#iv-pv-tags"), SAME("pv-tag1", "#iv-pv-tags g:nth-child(1) rect"), SAME("pv-tag3", "#iv-pv-tags g:nth-child(3) rect"), SAME("pv-more", "#iv-pv-tags > text"),
    SAME("caps", ".pm-side .il-caps"), SAME("cap-on", ".pm-side .il-cap.is-on"), SAME("pager", ".pm-side .il-pager"), SAME("dot-on", ".pm-side .il-pager button.is-on"),
  ];
  // sets: radio role, checked project keys, typed email, then optional submit
  const STATES = [
    { name: "empty" },
    { name: "typed", email: "newbie@acme.io", projects: ["AUT"] },
    { name: "many", email: "a-very-long-address-for-the-ticket@partner-company.example.io", projects: ["AUT", "BIL", "MOB", "DSN"] },
    { name: "admin", email: "boss@acme.io", role: "ADMIN" },
    { name: "emailerr", submit: true },
    { name: "member-err", email: "sarah@acme.io", submit: true },
    { name: "pending-err", email: "dina@acme.io", submit: true },
    { name: "done", email: () => `newbie${nextRun()}@acme.io`, projects: ["AUT", "BIL"], submit: true, done: true },
    { name: "done-admin", email: () => `boss${nextRun()}@acme.io`, role: "ADMIN", submit: true, done: true },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props }) => {
    const root = [...document.querySelectorAll("dialog[open]")].pop();
    const find = (sel) => [...root.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })[0] || (root.matches(sel) ? root : null);
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
      if (t) texts.push(t);
    }
    out.__texts = texts;
    out.__checked = [...root.querySelectorAll("input[type=checkbox]:checked")].map((i) => i.closest("label").querySelector(".ap-key").textContent).join(",");
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st, isRef) => {
    await page.click("#st-invite");
    await page.waitForSelector("dialog[open]", { timeout: 8000 });
    await wait(700);
    if (st.email) await page.fill("dialog[open] #iv-email", st.email);
    if (st.role) await page.check(`dialog[open] input[name=role][value=${st.role}]`);
    for (const k of st.projects ?? []) {
      const label = page.locator("dialog[open] .iv-p", { hasText: new RegExp(`^\\s*${k}`) });
      await label.locator("input").check();
    }
    if (st.submit) { await page.click("dialog[open] #iv-go"); await wait(st.done ? 3500 : 1800); }
    await wait(500);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      const cur = { ...st, email: typeof st.email === "function" ? st.email() : st.email }; // one address for the reference and for Next
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((c) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", "admin"); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await wait(2500);
      await act(cur, true);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, "sarah@acme.io");
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.slug}/settings`, { waitUntil: "networkidle" });
      await page.waitForSelector(".st-row:not(.st-skel)", { timeout: 60000 }).catch(() => {});
      await wait(2500);
      await act(cur, false);
      const B = await measure({ list: LIST.map((l) => [l[0], l[2]]), props: PROPS });

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
      report[key] = { checked: [A.__checked, B.__checked], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
