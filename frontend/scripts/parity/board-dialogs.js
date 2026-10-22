// Parity Gate for the Create task (SCR-TSK-03) and Reopen (SCR-TSK-02) dialogs.
// Reference: screens/groups/04-projects-tasks/board.html. Next: /{lang}/w/{slug}/projects/AUT.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/board-dialogs.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// SEED holds the throwaway test users and workspace (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/04-projects-tasks/board.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"sarah": "fe51.sarah.gq3lwq@veyro-test.io", "eng": "fe51-eng-gq3lwq"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("dlg", "dialog[open]"), SAME("form", ".pm-form, .st-dlg-in"), SAME("main", ".pm-main"), SAME("head", ".pm-head"), SAME("h2", "h2"), SAME("sub", ".pm-head p, .st-dlg-in > p"), SAME("x", ".pm-x"), SAME("alert", ".pm-alert:not([hidden])"),
    SAME("f-title", "#tk-f-title"), SAME("lrow", "#tk-f-title .pm-lrow"), SAME("l-title", "#tk-f-title label"), SAME("count", "#tk-count"), SAME("in-title", "#tk-name"), SAME("err-title", ".pm-err:not([hidden])"),
    SAME("count-d", "#tk-dcount"), SAME("ta", "#tk-desc"), SAME("legend", "legend"), SAME("prio", "#tk-prio"), SAME("prio1", "#tk-prio label:nth-child(1) .pr"), SAME("prio2", "#tk-prio label:nth-child(2) .pr"), SAME("prio3", "#tk-prio label:nth-child(3) .pr"), SAME("prio4", "#tk-prio label:nth-child(4) .pr"),
    SAME("two", ".tk-two"), SAME("sel-cat", "#tk-cat"), SAME("sel-as", "#tk-assignee"), SAME("l-cat", ".tk-two .pm-f:nth-child(1) label"), SAME("due", "#tk-due"), SAME("l-due", "label[for=tk-due]"),
    SAME("foot", ".pm-foot"), SAME("cancel", ".pm-foot .pm-ghost"), SAME("go", ".pm-foot .pm-go"),
    SAME("side", ".pm-side"), SAME("illu", ".pm-side .il-illu"), SAME("svg", ".pm-side svg"), SAME("pv-title", "#tk-pv-title"), SAME("pv-prio-r", "#tk-pv-prio-r"), SAME("pv-prio", "#tk-pv-prio"), SAME("pv-due", "#tk-pv-due"), SAME("pv-av", "#tk-pv-av"),
    SAME("caps", ".pm-side .il-caps"), SAME("cap-on", ".pm-side .il-cap.is-on"), SAME("pager", ".pm-side .il-pager"), SAME("dot-on", ".pm-side .il-pager button.is-on"),
    SAME("rp-ic", ".rp-ic"), SAME("rp-d", "#rp-d"), SAME("rp-flow", ".rp-flow"), SAME("rp-chip1", ".rp-flow .ap-st:nth-child(1)"), SAME("rp-arrow", ".rp-arrow"), SAME("rp-chip2", ".rp-flow .ap-st:nth-child(3)"),
    SAME("rp-f", "#rp-f"), SAME("rp-count", "#rp-count"), SAME("rp-ta", "#rp-reason"), SAME("rp-hint", "#rp-hint"), SAME("rp-foot", ".st-dlg-in .pm-foot"),
  ];
  const STATES = [
    { name: "create", open: { click: "#bd-add" } },
    { name: "create-filled", open: { click: "#bd-add" }, fill: [["#tk-name", "Ship the board dialogs"], ["#tk-desc", "Context for the team."]], check: ["#tk-prio label:nth-child(4) input"], select: [["#tk-cat", "BUG"], ["#tk-assignee", "member:1"]], date: "2026-10-30" },
    { name: "create-titleerr", open: { click: "#bd-add" }, submit: "#tk-go" },
    { name: "reopen-done", open: { menu: ".bd-col-done .bd-card:nth-child(1) .bd-more", item: 2 } },
    { name: "reopen-done-filled", open: { menu: ".bd-col-done .bd-card:nth-child(1) .bd-more", item: 2 }, fill: [["#rp-reason", "The fix did not hold in staging."]] },
    { name: "reopen-cancelled", open: { cancelled: true, menu: ".bd-col-cancelled .bd-card:nth-child(1) .bd-more", item: 2 } },
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
    out.__vals = [...root.querySelectorAll("input:not([type=radio]),textarea,select")].map((e) => e.value).join("|");
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st) => {
    if (st.open.cancelled) { await page.click("#bd-cancelled-toggle"); await wait(600); }
    if (st.open.click) await page.click(st.open.click);
    if (st.open.menu) {
      const col = /bd-col-(\w+)/.exec(st.open.menu)[1];
      if (page.viewportSize().width < 768) { await page.click(`.bd-tab:nth-child(${{ todo: 1, in_progress: 2, in_review: 3, done: 4, cancelled: 5 }[col]})`); await wait(400); }
      await page.click(st.open.menu); await wait(400);
      await page.click(`.bd-pop button:nth-child(${st.open.item})`);
    }
    await page.waitForSelector("dialog[open]", { timeout: 8000 });
    await wait(700);
    for (const [sel, val] of st.fill ?? []) await page.fill(`dialog[open] ${sel}`, val);
    for (const sel of st.check ?? []) await page.check(`dialog[open] ${sel}`);
    for (const [sel, val] of st.select ?? []) {
      const v = val.startsWith("member:") ? await page.evaluate(([s, i]) => document.querySelectorAll(`dialog[open] ${s} option`)[i].value, [sel, Number(val.split(":")[1]) + 1]) : val;
      await page.selectOption(`dialog[open] ${sel}`, v);
    }
    if (st.date) await page.fill("dialog[open] #tk-due", st.date);
    if (st.submit) { await page.click(`dialog[open] ${st.submit}`); await wait(900); }
    await wait(500);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((c) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", "admin"); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await wait(2500);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, SEED.sarah);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}/projects/AUT`, { waitUntil: "networkidle" });
      await page.waitForSelector(".bd-card", { timeout: 30000 });
      await wait(1500);
      await act(st);
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
