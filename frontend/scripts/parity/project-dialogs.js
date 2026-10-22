// Parity Gate for the project settings dialog (SCR-PRJ-05) and the archive / unarchive / delete confirm dialog.
// Reference: screens/groups/04-projects-tasks/projects.html (row menu). Next: /{lang}/w/{slug}/projects.
// Run with the Playwright MCP (filename = this file) or: node scripts/parity/run.mjs scripts/parity/project-dialogs.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// SEED holds the throwaway test users (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/04-projects-tasks/projects.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe49.mohand.f0rsbk@veyro-test.io", "sarah": "fe49.sarah.f0rsbk@veyro-test.io", "maya": "fe49.maya.f0rsbk@veyro-test.io", "eng": "fe49-eng-f0rsbk"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light", "role": "admin"}];
  const ONLY = CFG.states ?? null;
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah, padmin: SEED.maya };
  const SAME = (label, sel) => [label, sel, sel];
  const ORDER = ["MOB", "BIL", "AUT", "DSN", "BRD", "API"]; // the backend lists projects newest first
  const MENU = (n) => [".pj-row:nth-child(1) .pj-more", `.pj-row:nth-child(1) .pj-menu > :nth-child(${n})`];
  const LIST = [
    SAME("dlg", "dialog[open]"), SAME("form", ".pm-form"), SAME("main", ".pm-main"), SAME("head", ".pm-head"), SAME("h2", ".pm-head h2"), SAME("sub", ".pm-head p"), SAME("x", ".pm-x"), SAME("alert", ".pm-alert:not([hidden])"),
    SAME("f-name", ".pm-f:nth-of-type(1)"), SAME("l-name", ".pm-f:nth-of-type(1) label"), SAME("count-name", ".pm-f:nth-of-type(1) .pm-count"), SAME("in-name", "input[name=name]"), SAME("err-name", ".pm-err:not([hidden])"),
    SAME("f-key", ".pm-f:nth-of-type(2)"), SAME("count-key", ".pm-f:nth-of-type(2) .pm-count"), SAME("in-key", ".pj-key-in"),
    SAME("count-desc", ".pm-f:nth-of-type(3) .pm-count"), SAME("ta", "textarea"),
    SAME("danger", ".pj-danger:not([hidden])"), SAME("danger-h3", ".pj-danger h3"), SAME("dz1", ".pj-dz-row:not([hidden]):nth-of-type(1)"), SAME("dz1-b", ".pj-dz-row:not([hidden]) b"), SAME("dz1-p", ".pj-dz-row:not([hidden]) p"), SAME("dz1-btn", ".pj-dz-row:not([hidden]) .pm-btn"), SAME("dz-del", ".pj-dz-row .st-danger"), SAME("dz2", ".pj-dz-row:not([hidden]):nth-of-type(2)"),
    SAME("foot", ".pm-foot"), SAME("cancel", ".pm-foot .pm-ghost"), SAME("go", ".pm-foot .pm-go"), SAME("danger-yes", ".pm-foot .st-danger"),
    SAME("side", ".pm-side"), SAME("illu", ".pm-side .il-illu"), SAME("svg", ".pm-side svg"), SAME("t1-a", ".pm-side .il-float .il-t1"), SAME("caps", ".pm-side .il-caps"), SAME("cap-on", ".pm-side .il-cap.is-on"), SAME("pager", ".pm-side .il-pager"), SAME("dot-on", ".pm-side .il-pager button.is-on"),
    SAME("cf-in", ".st-dlg-in"), SAME("cf-h2", ".st-dlg-in h2"), SAME("cf-p", ".st-dlg-in p"), SAME("cf-foot", ".st-dlg-in .pm-foot"),
  ];
  const STATES = [
    { name: "settings", role: "admin", steps: [MENU(2)] },
    { name: "settings-padmin", role: "padmin", steps: [MENU(2)] },
    { name: "settings-archived", role: "admin", steps: [[".pj-seg button:nth-child(2)"], MENU(2)] },
    { name: "nameerr", role: "admin", steps: [MENU(2)], fill: ["input[name=name]", ""], submit: true },
    { name: "confirm-archive", role: "admin", steps: [MENU(3)] },
    { name: "confirm-delete", role: "admin", steps: [MENU(4)] },
    { name: "confirm-unarchive", role: "admin", steps: [[".pj-seg button:nth-child(2)"], MENU(3)] },
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
    out.__vals = [...root.querySelectorAll("input,textarea")].map((e) => e.value).join("|");
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const sortRef = () => page.evaluate((order) => {
    const box = document.getElementById("pj-rows");
    if (!box) return;
    [...box.children].sort((a, b) => order.indexOf(a.querySelector(".ap-key")?.textContent) - order.indexOf(b.querySelector(".ap-key")?.textContent)).forEach((r) => box.append(r));
  }, ORDER);

  const act = async (st, ref) => {
    for (const step of st.steps) {
      for (const sel of step) { await page.click(sel); await wait(sel.includes("pj-seg") ? 2200 : 700); if (ref) await sortRef(); }
    }
    await page.waitForSelector("dialog[open]", { timeout: 8000 });
    await wait(700);
    if (st.fill) { await page.fill(`dialog[open] ${st.fill[0]}`, st.fill[1]); }
    if (st.submit) { await page.click("dialog[open] .pm-foot .pm-go"); await wait(1000); }
    await wait(500);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const role = st.role === "admin" && c.role === "owner" ? "owner" : st.role;
      const key = `${st.name} ${role} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role, c });
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await wait(1500);
      await sortRef();
      await act(st, true);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}/projects`, { waitUntil: "networkidle" });
      await page.waitForSelector(".pj-row:not(.st-skel)", { timeout: 30000 });
      await wait(1500);
      await act(st, false);
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
      report[key] = { vals: [A.__vals, B.__vals], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
