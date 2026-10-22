// Parity Gate for the Create Project dialog (SCR-PRJ-02).
// Reference: screens/groups/03-workspace-dashboard/index.html (the dialog opens from #ap-create). Next: the same button in the shell of /{lang}/w/{slug}.
// Run with the Playwright MCP (filename = this file) or: node scripts/parity/run.mjs scripts/parity/create-project.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// SEED holds the throwaway test users (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/index.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe48.mohand.eyv7c5@veyro-test.io", "sarah": "fe48.sarah.eyv7c5@veyro-test.io", "leo": "fe48.leo.eyv7c5@veyro-test.io", "eng": "fe48-eng-eyv7c5"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light", "role": "admin"}];
  const ONLY = CFG.states ?? null;
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah };
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("dlg", ".pm"), SAME("form", ".pm-form"), SAME("main", ".pm-main"), SAME("head", ".pm-head"), SAME("h2", ".pm-head h2"), SAME("sub", ".pm-head p"), SAME("x", ".pm-x"), SAME("alert", ".pm-alert:not([hidden])"),
    SAME("f-name", ".pm-f:nth-of-type(1)"), SAME("l-name", ".pm-f label[for]"), SAME("in-name", "input[name=name]"), SAME("err-name", ".pm-f .pm-err:not([hidden])"),
    SAME("lrow-key", ".pm-lrow"), SAME("auto", ".pm-auto"), SAME("keyrow", ".pm-keyrow"), SAME("in-key", "input[name=key]"), SAME("reset", ".pm-link:not([hidden])"), SAME("hint", ".pm-hint"),
    SAME("count", ".pm-count"), SAME("ta", "textarea[name=description]"), SAME("note", ".pm-note"), SAME("foot", ".pm-foot"), SAME("cancel", ".pm-foot .pm-ghost"), SAME("go", ".pm-foot .pm-go"),
    SAME("side", ".pm-side"), SAME("illu", ".pm-side .il-illu"), SAME("svg", ".pm-side svg"), SAME("flag", ".il-flag"), SAME("flag-t", ".il-tw"), SAME("folder-t", ".il-t1"), SAME("meta", ".il-t2"), SAME("pill", ".il-pill"), SAME("seg-used", ".il-seg.used"), SAME("seg-next", ".il-seg.next"),
    SAME("caps", ".pm-side .il-caps"), SAME("cap-on", ".pm-side .il-cap.is-on"), SAME("pager", ".pm-side .il-pager"), SAME("dot", ".pm-side .il-pager button"), SAME("dot-on", ".pm-side .il-pager button.is-on"),
  ];
  const STATES = [
    { name: "empty" },
    { name: "filled", fill: [["input[name=name]", "Website Relaunch"], ["textarea[name=description]", "The marketing site, rebuilt."]] },
    { name: "keytouched", fill: [["input[name=name]", "Website Relaunch"], ["input[name=key]", "web"]] },
    { name: "nameerr", submit: true },
    { name: "keytaken", fill: [["input[name=name]", "x"], ["input[name=key]", "AUT"]], submit: true },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props }) => {
    const root = document.querySelector("dialog[open]");
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

  const act = async (st, c) => {
    for (const [sel, val] of st.fill ?? []) await page.fill(`dialog[open] ${sel}`, val);
    if (st.submit) { await page.click("dialog[open] .pm-foot .pm-go"); await wait(1500); }
    await wait(500);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.role} ${c.w} ${c.lang} ${c.theme}`;
      // reference
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((c) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", c.role); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await wait(1500);
      await page.evaluate(() => document.querySelector("#ap-create").click());
      await page.waitForSelector("dialog[open]");
      await wait(700);
      await act(st, c);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      // Next
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[c.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".ap-kpi", { timeout: 30000 });
      await wait(1500);
      await page.evaluate(() => document.querySelector(".ap-create").click());
      await page.waitForSelector("dialog[open]", { timeout: 10000 });
      await wait(700);
      await act(st, c);
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
