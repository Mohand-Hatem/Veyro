// Parity Gate for the project board (SCR-PRJ-01), content area only (the shell has its own run: shell.js).
// Reference: screens/groups/04-projects-tasks/board.html. Next: /{lang}/w/{slug}/projects/{KEY}.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/board.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000.
// SEED holds the throwaway test users and workspace (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/04-projects-tasks/board.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe50.mohand.j898bf@veyro-test.io", "sarah": "fe50.sarah.j898bf@veyro-test.io", "maya": "fe50.maya.j898bf@veyro-test.io", "leo": "fe50.leo.j898bf@veyro-test.io", "eng": "fe50-eng-j898bf"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const ONLY = CFG.states ?? null;
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light", "role": "admin"}];
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah, padmin: SEED.maya, member: SEED.leo };
  const KEYS = { full: "AUT", empty: "EMP", readonly: "ROP", archived: "ARC" };
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("crumbs", ".bd-crumbs"), SAME("crumb-a", ".bd-crumbs a"), SAME("crumb-sep", ".bd-crumbs span"), SAME("crumb-b", ".bd-crumbs b"),
    SAME("head", ".bd-head"), SAME("head-l", ".bd-head-l"), SAME("title", ".bd-title"), SAME("key", "#bd-key"), SAME("name", "#bd-name"), SAME("status", "#bd-status"), SAME("desc", ".bd-desc"),
    SAME("meta", ".bd-meta"), SAME("stack", ".bd-stack"), SAME("av1", ".bd-stack .bd-av:nth-child(1)"), SAME("av2", ".bd-stack .bd-av:nth-child(2)"), SAME("av5", ".bd-stack .bd-av:nth-child(5)"), SAME("mcount", ".bd-mcount"), SAME("mlink", ".bd-mlink"), SAME("note", ".bd-note"),
    SAME("actions", ".bd-actions"), SAME("add", "#bd-add"), SAME("add-svg", "#bd-add svg"), SAME("trash", "#bd-trash"), SAME("settings", "#bd-settings"),
    SAME("gauge", ".bd-gauge"), SAME("gwrap", ".bd-gauge .ap-gwrap"), SAME("gsvg", ".bd-gauge svg"), SAME("g-track", ".g-track"), SAME("g-done", ".g-done"), SAME("g-rev", ".g-rev"), SAME("g-doing", ".g-doing"), SAME("ticks", ".g-ticks text"), SAME("gc", ".ap-gc"), SAME("gc-b", ".ap-gc b"), SAME("gc-s", ".ap-gc span"),
    SAME("gstats", ".ap-gstats"), SAME("gs1", ".ap-gstats > div:nth-child(1)"), SAME("gs1-dd", ".ap-gstats > div:nth-child(1) dd"), SAME("gs1-dt", ".ap-gstats > div:nth-child(1) dt"), SAME("gs2", ".gs-done"), SAME("gs2-dd", ".gs-done dd"), SAME("gs3-dd", ".gs-rev dd"), SAME("gs4-dd", ".gs-doing dd"), SAME("gnote", ".bd-gauge .ap-gnote"),
    SAME("banner", ".bd-banner"), SAME("banner-b", ".bd-banner b"), SAME("banner-s", ".bd-banner span"),
    SAME("tools", ".bd-tools"), SAME("search", ".bd-search"), SAME("search-svg", ".bd-search svg"), SAME("search-in", ".bd-search input"), SAME("sel1", ".bd-tools .ap-select:nth-of-type(2)"), SAME("sel1-in", ".bd-tools .ap-select:nth-of-type(2) select"), SAME("sel2-in", ".bd-tools .ap-select:nth-of-type(3) select"), SAME("sel3-in", ".bd-tools .ap-select:nth-of-type(4) select"), SAME("chip", ".au-chip"), SAME("chip-i", ".au-chip i"),
    SAME("tabs", ".bd-tabs"), SAME("tab1", ".bd-tab:nth-child(1)"), SAME("tab1-i", ".bd-tab:nth-child(1) i"), SAME("tab-on", ".bd-tab[aria-selected=true]"), SAME("tab5", ".bd-tab:nth-child(5)"),
    SAME("board", ".bd-board"), SAME("col1", ".bd-col-todo"), SAME("col1-h", ".bd-col-todo > header"), SAME("col1-hb", ".bd-col-todo > header b"), SAME("col1-cnt", ".bd-col-todo .st-count"), SAME("col1-plus", ".bd-colplus"), SAME("col1-cards", ".bd-col-todo .bd-cards"),
    SAME("col2", ".bd-col-in_progress"), SAME("col3", ".bd-col-in_review"), SAME("col4", ".bd-col-done"), SAME("col5", ".bd-col-cancelled"), SAME("col4-cnt", ".bd-col-done .st-count"),
    SAME("card1", ".bd-col-todo .bd-card:nth-child(1)"), SAME("tags", ".bd-col-todo .bd-card:nth-child(1) .bd-tags"), SAME("pr", ".bd-col-todo .bd-card:nth-child(1) .pr"), SAME("cat", ".bd-col-todo .bd-card:nth-child(1) .bd-cat"), SAME("more", ".bd-col-todo .bd-card:nth-child(1) .bd-more"), SAME("more-svg", ".bd-col-todo .bd-card:nth-child(1) .bd-more svg"),
    SAME("cn", ".bd-col-todo .bd-card:nth-child(1) .bd-cn"), SAME("cf", ".bd-col-todo .bd-card:nth-child(1) .bd-cf"), SAME("due", ".bd-col-todo .bd-card:nth-child(1) .bd-due"), SAME("due-svg", ".bd-col-todo .bd-card:nth-child(1) .bd-due svg"), SAME("cm", ".bd-col-todo .bd-card:nth-child(1) .bd-cm"), SAME("cav", ".bd-col-todo .bd-card:nth-child(1) .bd-cf .bd-av"),
    SAME("card2", ".bd-col-todo .bd-card:nth-child(2)"), SAME("card3", ".bd-col-todo .bd-card:nth-child(3)"), SAME("card-none", ".bd-av-none"), SAME("card-late", ".bd-due.is-late"), SAME("card-canc", ".bd-card.is-cancelled"),
    SAME("done-card", ".bd-col-done .bd-card:nth-child(1)"), SAME("progress-card", ".bd-col-in_progress .bd-card:nth-child(1)"), SAME("review-card", ".bd-col-in_review .bd-card:nth-child(1)"), SAME("card-last", ".bd-col-done .bd-card:last-child"),
    SAME("colempty", ".bd-colempty"), SAME("empty-card", ".bd-empty-card"), SAME("empty-svg", ".bd-empty-card svg"), SAME("empty-b", ".bd-empty-card b"), SAME("empty-p", ".bd-empty-card p"), SAME("empty-btn", ".bd-empty-card .pm-btn"),
    SAME("pop", ".bd-pop"), SAME("pop-b1", ".bd-pop button:nth-child(1)"), SAME("pop-b2", ".bd-pop button:nth-child(2)"), SAME("pop-b3", ".bd-pop button:nth-child(3)"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
  ];
  const STATES = [
    { name: "full", scn: "full" },
    { name: "empty", scn: "empty" },
    { name: "readonly", scn: "readonly" },
    { name: "archived", scn: "archived" },
    { name: "error", scn: "error" },
    { name: "cancelled", scn: "full", click: "#bd-cancelled-toggle" },
    { name: "filtered", scn: "full", fill: ["#bd-q", "oauth"] },
    { name: "menu", scn: "full", click: ".bd-col-todo .bd-card:nth-child(1) .bd-more" },
    { name: "menu-done", scn: "full", click: ".bd-col-done .bd-card:nth-child(1) .bd-more" },
    { name: "tab", scn: "full", phone: true, click: ".bd-tab:nth-child(3)" },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

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
    for (const el of [...document.querySelectorAll(".ap-body *"), ...document.querySelectorAll(".bd-pop, .bd-pop *")]) {
      if (el.closest("svg") && el.tagName !== "text") continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden") continue;
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t && !/prototype/i.test(t)) texts.push(t);
    }
    out.__texts = texts;
    out.__cards = document.querySelectorAll(".bd-card").length;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const clickFailed = [];
  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      if (st.phone && c.w >= 768) continue;
      const key = `${st.name} ${c.role} ${c.w} ${c.lang} ${c.theme}`;
      // reference
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((c) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", c.role); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      if (st.scn !== "full") await page.selectOption("#bd-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove()); // reference-only prototype controls
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      if (st.click) { await page.click(st.click, { timeout: 4000 }).catch(() => { clickFailed.push(key); }); await wait(900); }
      if (st.fill) { await page.fill(st.fill[0], st.fill[1]); await wait(900); }
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      // Next
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[c.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const ERR = /\/api\/v1\/projects\/[^/?]+$/;
      if (st.scn === "error") await page.route(ERR, (r) => r.abort());
      else await page.unroute(ERR).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}/projects/${KEYS[st.scn] ?? "AUT"}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".bd-card, .bd-empty-card, .st-error", { timeout: 30000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      if (st.click) { await page.click(st.click, { timeout: 4000 }).catch(() => { clickFailed.push(key); }); await wait(900); }
      if (st.fill) { await page.fill(st.fill[0], st.fill[1]); await wait(900); }
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
      report[key] = { rows: [A.__cards, B.__cards], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 40) };
    }
  }
  if (clickFailed.length) report.__clickFailed = clickFailed;
  return report;
}
