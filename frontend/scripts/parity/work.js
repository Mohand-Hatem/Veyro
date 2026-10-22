// Parity Gate for the Projects (SCR-PRJ-04) and My tasks (SCR-TSK-04) pages, content area only (the shell has its own run: shell.js).
// Reference: screens/groups/04-projects-tasks/projects.html and my-tasks.html. Next: /{lang}/w/{slug}/projects and /my-tasks.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/work.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000.
// SEED holds the throwaway test users (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/04-projects-tasks/";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe47.mohand.evlixq@veyro-test.io", "sarah": "fe47.sarah.evlixq@veyro-test.io", "leo": "fe47.leo.evlixq@veyro-test.io", "eng": "fe47-eng-evlixq", "labs": "fe47-labs-evlixq"};
  // From the shell, PARITY_CFG='{"pages":[...],"scn":"limit","combos":[...]}' overrides these defaults.
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const PAGES = CFG.pages ?? ["projects", "my-tasks"];
  const SCN = CFG.scn ?? "full";
  const ONLY = CFG.states ?? null; // state names to run, e.g. ["list","menu"]
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light", "role": "admin"}];
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah, member: SEED.leo };
  const SAME = (label, sel) => [label, sel, sel];
  const ORDER = ["MOB", "BIL", "AUT", "DSN", "BRD", "API"]; // the backend lists projects newest first

  const COMMON = [SAME("ovh", ".ap-ovh"), SAME("crumbs", ".bd-crumbs"), SAME("crumb-a", ".bd-crumbs a"), SAME("crumb-sep", ".bd-crumbs span"), SAME("crumb-b", ".bd-crumbs b")];
  const LISTS = {
    projects: [
      SAME("tools", ".pj-tools"), SAME("trow", ".pj-trow"), SAME("search", ".pj-search"), SAME("search-svg", ".pj-search svg"), SAME("search-in", ".pj-search input"),
      SAME("seg", ".pj-seg"), SAME("seg1", ".pj-seg button:nth-child(1)"), SAME("seg2", ".pj-seg button:nth-child(2)"), SAME("seg3", ".pj-seg button:nth-child(3)"),
      SAME("cap", ".pj-cap"), SAME("new", ".pj-new"), SAME("new-svg", ".pj-new svg"),
      SAME("list", ".pj-list"), SAME("list-h2", ".pj-list h2"), SAME("count", ".st-count"), SAME("note", ".st-note"), SAME("th", ".pj-th"), SAME("th1", ".pj-th span:nth-child(1)"), SAME("th4", ".pj-th span:nth-child(4)"),
      SAME("row1", ".pj-row:nth-child(1)"), SAME("name", ".pj-row:nth-child(1) .pj-name"), SAME("key", ".pj-row:nth-child(1) .ap-key"), SAME("nm-b", ".pj-row:nth-child(1) .pj-nm b"), SAME("nm-a", ".pj-row:nth-child(1) .pj-nm a"), SAME("nm-small", ".pj-row:nth-child(1) .pj-nm small"),
      SAME("mem", ".pj-row:nth-child(1) .pj-mem"), SAME("stack", ".pj-row:nth-child(1) .bd-stack"), SAME("av1", ".pj-row:nth-child(1) .bd-av:nth-child(1)"), SAME("av2", ".pj-row:nth-child(1) .bd-av:nth-child(2)"), SAME("mem-small", ".pj-row:nth-child(1) .pj-mem small"),
      SAME("prog", ".pj-row:nth-child(1) .pj-prog"), SAME("bar", ".pj-row:nth-child(1) .pj-bar"), SAME("bar-i", ".pj-row:nth-child(1) .pj-bar i"), SAME("prog-small", ".pj-row:nth-child(1) .pj-prog small"),
      SAME("cr", ".pj-row:nth-child(1) .pj-cr"), SAME("cr-b", ".pj-row:nth-child(1) .pj-cr b"), SAME("cr-small", ".pj-row:nth-child(1) .pj-cr small"), SAME("st", ".pj-row:nth-child(1) .ap-st"), SAME("act", ".pj-row:nth-child(1) .pj-act"), SAME("more", ".pj-row:nth-child(1) .pj-more"), SAME("restore", ".pj-row:nth-child(1) .pm-btn"),
      SAME("row2", ".pj-row:nth-child(2)"), SAME("row3", ".pj-row:nth-child(3)"), SAME("row-last", ".pj-row:last-child"), SAME("st-ro", ".st-readonly"), SAME("st-arch", ".st-archived"), SAME("st-locked", ".gv-st-locked"),
      SAME("menu", ".pj-menu:not([hidden])"), SAME("menu-a", ".pj-menu:not([hidden]) a"), SAME("menu-b", ".pj-menu:not([hidden]) button"), SAME("menu-danger", ".pj-menu:not([hidden]) .is-danger"),
      SAME("empty", ".pj-empty"), SAME("empty-ill", ".pj-empty-ill"), SAME("empty-svg", ".pj-empty-ill svg"), SAME("empty-h2", ".pj-empty h2"), SAME("empty-p", ".pj-empty p"), SAME("empty-act", ".pj-empty-act"), SAME("empty-btn", ".pj-empty-act .pm-btn"),
      SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
    ],
    "my-tasks": [
      SAME("head", ".mt-head"), SAME("head-h2", ".mt-head h2"), SAME("head-p", ".mt-head p"), SAME("ctl", ".mt-ctl"), SAME("view", ".mt-ctl .ap-seg"), SAME("view1", ".mt-ctl .ap-seg button:nth-child(1)"), SAME("view2", ".mt-ctl .ap-seg button:nth-child(2)"), SAME("view-n", ".mt-n"),
      SAME("sel", ".mt-ctl .ap-select"), SAME("sel-in", ".mt-ctl select"),
      SAME("chips", ".mt-chips"), SAME("chip1", ".mt-chip:nth-child(1)"), SAME("chip1-b", ".mt-chip:nth-child(1) b"), SAME("chip1-s", ".mt-chip:nth-child(1) span"), SAME("chip2", ".mt-chip:nth-child(2)"), SAME("chip5", ".mt-chip:nth-child(5)"), SAME("chip-over", ".mt-chip.is-over"),
      SAME("list", ".mt-list"), SAME("gh1", ".mt-gh:nth-of-type(1)"), SAME("gh-over", ".mt-gh.is-over"), SAME("row1", ".mt-row:nth-of-type(1)"), SAME("pr1", ".mt-row .pr"), SAME("tt1", ".mt-row .mt-tt"), SAME("key1", ".mt-row .ap-key"), SAME("tt-b", ".mt-row .mt-tt b"), SAME("row-st", ".mt-row > .ap-st"), SAME("due1", ".mt-row .mt-due"), SAME("due-over", ".mt-due.is-over"), SAME("due-today", ".mt-due.is-today"),
      SAME("row2", ".mt-row:nth-of-type(2)"), SAME("row-last", ".mt-row:last-of-type"), SAME("pager", ".au-pager"), SAME("range", ".au-range"), SAME("pbtns", ".au-pbtns"), SAME("prev", ".au-pbtns .pm-btn:nth-child(1)"), SAME("next", ".au-pbtns .pm-btn:nth-child(2)"),
      SAME("empty", ".mt-empty"), SAME("empty-ill", ".mt-empty-ill"), SAME("empty-svg", ".mt-empty-ill svg"), SAME("empty-h2", ".mt-empty h2"), SAME("empty-p", ".mt-empty p"), SAME("empty-act", ".mt-empty-act"), SAME("empty-btn", ".mt-empty-act .pm-btn"),
      SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
    ],
  };
  const STATES = {
    projects: [
      { name: "list" },
      { name: "error" },
      { name: "archived", click: ".pj-seg button:nth-child(2)" },
      { name: "deleted", priv: true, click: ".pj-seg button:nth-child(3)" },
      { name: "match", fill: [".pj-search input", "zzzz"] },
      { name: "menu", click: ".pj-row:nth-child(1) .pj-more" },
    ],
    "my-tasks": [
      { name: "list" },
      { name: "error" },
      { name: "done", click: ".mt-ctl .ap-seg button:nth-child(2)" },
      { name: "overdue", click: ".mt-chip:nth-child(2)" },
      // the reference shows its pager only above eight tasks, so it is forced on to compare the pager itself
      { name: "pager", refPatch: () => { document.querySelector("#mt-pager").hidden = false; document.querySelector("#mt-range").textContent = "1–8 of 11"; document.querySelector("#mt-next").disabled = false; } },
    ],
  };

  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display"];
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
    for (const el of document.querySelectorAll(".ap-body *")) {
      if (el.closest("svg") && el.tagName !== "text") continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden") continue;
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t && !/prototype/i.test(t)) texts.push(t);
    }
    out.__texts = texts;
    out.__rows = document.querySelectorAll(".pj-row, .mt-row").length;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  // the reference lists projects in its own array order; the backend lists them newest first
  const sortRef = () => page.evaluate((order) => {
    const box = document.getElementById("pj-rows");
    if (!box) return;
    [...box.children].sort((a, b) => order.indexOf(a.querySelector(".ap-key")?.textContent) - order.indexOf(b.querySelector(".ap-key")?.textContent)).forEach((r) => box.append(r));
  }, ORDER);

  const clickFailed = [];
  const report = {};
  for (const pg of PAGES) {
    const LIST = [...COMMON, ...LISTS[pg]];
    for (const c of COMBOS) {
      await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
      for (const st of STATES[pg]) {
        if (st.priv && c.role === "member") continue;
        if (ONLY && !ONLY.includes(st.name)) continue;
        if (st.name === "menu" && c.w < 700) { /* the row menu works the same on a phone */ }
        const key = `${pg} ${st.name} ${SCN} ${c.role} ${c.w} ${c.lang} ${c.theme}`;
        // reference
        await page.goto(`${REF}${pg}.html`, { waitUntil: "load" });
        await page.evaluate((c) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", c.role); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
        await page.reload({ waitUntil: "load" });
        if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
        const scnSel = pg === "projects" ? "#pj-scn" : "#mt-scn";
        // my tasks has its own name for "a project is read-only"
        const refScn = st.name === "error" ? "error" : SCN === "limit" && pg === "my-tasks" ? "readonly" : SCN === "empty" ? "empty" : "full";
        await page.selectOption(scnSel, refScn);
        await page.evaluate(() => document.querySelector(".ap-proto")?.remove()); // reference-only prototype controls
        await sortRef();
        await page.addStyleTag({ content: "html{overflow-y:scroll}" });
        await wait(2500);
        if (st.click) { await page.click(st.click, { timeout: 4000 }).catch(() => { clickFailed.push(key); }); await wait(1800); await sortRef(); }
        if (st.fill) { await page.fill(st.fill[0], st.fill[1]); await wait(1800); await sortRef(); }
        if (st.refPatch) await page.evaluate(st.refPatch);
        const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
        // Next
        await page.context().clearCookies();
        await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
        const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[c.role]);
        if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
        await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
        if (st.name === "error") await page.route(/\/api\/v1\/workspaces\/[^/]+\/(projects|my-tasks)/, (r) => r.abort());
        else await page.unroute(/\/api\/v1\/workspaces\/[^/]+\/(projects|my-tasks)/).catch(() => {});
        await page.goto(`${NEXT}/${c.lang}/w/${SCN === "empty" ? SEED.labs : SEED.eng}/${pg}`, { waitUntil: "networkidle" });
        await page.waitForSelector(".pj-row, .mt-row, .ap-empty, .st-error", { timeout: 25000 }).catch(() => {});
        await page.addStyleTag({ content: "html{overflow-y:scroll}" });
        await wait(2500);
        if (st.click) { await page.click(st.click, { timeout: 4000 }).catch(() => { clickFailed.push(key); }); await wait(1800); }
        if (st.fill) { await page.fill(st.fill[0], st.fill[1]); await wait(1800); }
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
        report[key] = { rows: [A.__rows, B.__rows], overflowPx: [A.__scrollW, B.__scrollW], missing, extra, n: diffs.length, diffs: diffs.slice(0, 30) };
      }
    }
  }
  if (clickFailed.length) report.__clickFailed = clickFailed;
  return report;
}
