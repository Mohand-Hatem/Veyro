// Parity Gate for the workspace dashboard (SCR-WKSP-01), content area only (the shell has its own run: shell.js).
// Reference: screens/groups/03-workspace-dashboard/index.html. Next: /{lang}/w/{slug}, signed in as the persona of the role.
// The reference scenario (#ap-scn) is matched by the real account state set with the temporary seed script (full, empty, limit, grace, pastdue, downgraded).
// Run through the Playwright MCP (filename = this file) with the static server on :4173, the frontend on :3000 and the backend on :5000.
// SEED holds the throwaway test users (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const PROTO = "http://localhost:4173/screens/groups/03-workspace-dashboard/index.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe46.mohand.e0seyn@veyro-test.io", "sarah": "fe46.sarah.e0seyn@veyro-test.io", "leo": "fe46.leo.e0seyn@veyro-test.io", "eng": "fe46-eng-e0seyn", "labs": "fe46-labs-e0seyn"};
  const SCN = "empty";
  const COMBOS = [{"w": 1440, "lang": "en", "theme": "light", "role": "admin"}, {"w": 1440, "lang": "en", "theme": "light", "role": "member"}, {"w": 390, "lang": "ar", "theme": "dark", "role": "owner"}];
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah, member: SEED.leo };
  const settle = () => page.waitForTimeout(5200); // the reference cards and beads animate in with staggered delays
  const SAME = (label, sel) => [label, sel, sel];

  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("ovh-h2", ".ap-ovh h2"),
    SAME("kpis", ".ap-kpis"), SAME("kpi1", ".ap-kpi:nth-child(1)"), SAME("kpi2", ".ap-kpi:nth-child(2)"), SAME("kpi3", ".ap-kpi:nth-child(3)"), SAME("kpi4", ".ap-kpi:nth-child(4)"),
    SAME("kic1", ".ap-kic.c1"), SAME("kic4", ".ap-kic.c4"), SAME("kl", ".ap-kl"), SAME("kv", ".ap-kv"), SAME("kv-small", ".ap-kv small"), SAME("kt", ".ap-kt"), SAME("kt-warn", ".ap-kt.warn"), SAME("kt-up", ".ap-kt.up"),
    SAME("notice", ".ap-notice:not([hidden])"), SAME("nb", ".ap-nb"), SAME("nb-ic", ".ap-nb-ic"), SAME("nb-b", ".ap-nb b"), SAME("nb-p", ".ap-nb p"), SAME("nb-btn", ".ap-nb-btn"),
    SAME("grid", ".ap-grid"), SAME("proj", ".ap-proj"), SAME("proj-h2", ".ap-proj h2"), SAME("proj-select", ".ap-proj .ap-select select"), SAME("th", ".ap-th"), SAME("th-1", ".ap-th span:nth-child(1)"),
    SAME("row1", ".ap-row:nth-child(1)"), SAME("row1-pn", ".ap-row:nth-child(1) .ap-pn b"), SAME("row1-key", ".ap-row:nth-child(1) .ap-key"), SAME("row1-stack", ".ap-row:nth-child(1) .ap-stack"), SAME("row1-av1", ".ap-row:nth-child(1) .ap-stack span:nth-child(1)"),
    SAME("row1-tasks", ".ap-row:nth-child(1) span[role=cell]:nth-child(3)"), SAME("row1-date", ".ap-row:nth-child(1) span[role=cell]:nth-child(4)"), SAME("row1-st", ".ap-row:nth-child(1) .ap-st"), SAME("row1-ring", ".ap-row:nth-child(1) .ap-ring"), SAME("row1-ringtext", ".ap-row:nth-child(1) .ap-ring text"),
    SAME("row2", ".ap-row:nth-child(2)"), SAME("row-last", ".ap-row:last-child"), SAME("st-archived", ".st-archived"), SAME("st-readonly", ".st-readonly"),
    SAME("gauge", ".ap-gauge"), SAME("gauge-h2", ".ap-gauge h2"), SAME("gauge-select", ".ap-gauge select"), SAME("gwrap", ".ap-gwrap"), SAME("gsvg", ".ap-gwrap svg"), SAME("g-track", ".g-track"), SAME("gc", ".ap-gc"), SAME("gc-b", ".ap-gc b"), SAME("gc-span", ".ap-gc span"),
    SAME("gstats", ".ap-gstats"), SAME("gstat1", ".ap-gstats div:nth-child(1)"), SAME("gstat-dd", ".ap-gstats dd"), SAME("gstat-dt", ".ap-gstats dt"), SAME("gs-done", ".gs-done dd"), SAME("gnote", ".ap-gnote"),
    SAME("today", ".ap-today"), SAME("today-h2", ".ap-today h2"), SAME("tabs", ".ap-tabs"), SAME("tab1", ".ap-tab:nth-child(1)"), SAME("tab1-i", ".ap-tab:nth-child(1) i"), SAME("tab2", ".ap-tab:nth-child(2)"),
    SAME("tl", ".ap-tl"), SAME("ti1", ".ap-ti:nth-child(1)"), SAME("ck1", ".ap-ti:nth-child(1) .ap-ck"), SAME("ti1-b", ".ap-ti:nth-child(1) .ap-ti-t b"), SAME("ti1-small", ".ap-ti:nth-child(1) .ap-ti-t small"), SAME("ti1-key", ".ap-ti:nth-child(1) .ap-key"), SAME("ti1-st", ".ap-ti:nth-child(1) .ap-st"), SAME("ti2", ".ap-ti:nth-child(2)"), SAME("ti-last", ".ap-ti:last-child"),
    SAME("wl", ".ap-wl"), SAME("wl-h2", ".ap-wl h2"), SAME("wl-chip", ".ap-chip"), SAME("bars", ".ap-bars"), SAME("col1", ".ap-col:nth-child(1)"), SAME("beads1", ".ap-col:nth-child(1) .ap-beads"), SAME("bead-top", ".ap-bead.top"), SAME("bead-peak", ".ap-bead.peak"), SAME("col1-small", ".ap-col:nth-child(1) small"), SAME("col-last", ".ap-col:last-child"),
    SAME("mine", ".ap-mine"), SAME("mine-h2", ".ap-mine h2"), SAME("mine-illu", ".ap-mine .il-illu"), SAME("mine-svg", ".ap-mine .il-illu svg"), SAME("mine-caps", ".ap-mine .il-caps"), SAME("mine-cap", ".ap-mine .il-cap.is-on"), SAME("mine-pager", ".ap-mine .il-pager"), SAME("mine-dot", ".ap-mine .il-pager button"),
    SAME("empty", ".ap-empty"), SAME("empty-ill", ".ap-empty-ill"), SAME("empty-h2", ".ap-empty h2"), SAME("empty-p", ".ap-empty p"), SAME("empty-btn", ".ap-btn"),
  ];

  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display"];
  const mask = (t) => t.replace(/\d+/g, "#");

  const measure = (args) => page.evaluate(({ list, props }) => {
    const find = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })[0] || null;
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
    for (const root of document.querySelectorAll(".ap-body")) {
      for (const el of root.querySelectorAll("*")) {
        if (el.closest("svg") && el.tagName !== "text") continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === "hidden") continue;
        const t = el.textContent.replace(/\s+/g, " ").trim();
        if (t && !/prototype/i.test(t)) texts.push(t);
      }
    }
    out.__texts = texts;
    out.__rows = document.querySelectorAll(".ap-row").length;
    out.__tasks = document.querySelectorAll(".ap-ti").length;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const report = {};
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    const key = `${SCN} ${c.role} ${c.w} ${c.lang} ${c.theme}`;
    // reference
    await page.goto(PROTO, { waitUntil: "load" });
    await page.evaluate((c) => { sessionStorage.setItem("veyro-proto-role", c.role); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
    await page.reload({ waitUntil: "load" });
    if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
    await page.selectOption("#ap-scn", SCN);
    await page.evaluate(() => {
      document.querySelector(".ap-proto")?.remove(); // reference-only prototype controls
      // the backend lists projects newest first; the reference lists them in its own array order
      const box = document.getElementById("ap-rows");
      const order = ["MOB", "BIL", "AUT", "DSN", "API"];
      [...box.children].sort((a, b) => order.indexOf(a.querySelector(".ap-key").textContent) - order.indexOf(b.querySelector(".ap-key").textContent)).forEach((r) => box.append(r));
    });
    await page.addStyleTag({ content: "html{overflow-y:scroll}" });
    await settle();
    const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
    // Next
    await page.context().clearCookies();
    await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
    const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[c.role]);
    if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
    await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
    await page.goto(`${NEXT}/${c.lang}/w/${SCN === "empty" ? SEED.labs : SEED.eng}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".ap-kpi", { timeout: 15000 }).catch(() => {});
    await page.addStyleTag({ content: "html{overflow-y:scroll}" });
    await page.waitForTimeout(3200); // cards rise in after data arrives; wait for the animation to end
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
    const missing = [...new Set(ta.filter((t) => !tb.includes(t)))];
    const extra = [...new Set(tb.filter((t) => !ta.includes(t)))];
    report[key] = { rows: [A.__rows, B.__rows], tasks: [A.__tasks, B.__tasks], overflowPx: [A.__scrollW, B.__scrollW], missing, extra, n: diffs.length, diffs: diffs.slice(0, 40) };
  }
  return report;
}
