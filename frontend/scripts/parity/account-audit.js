// Parity Gate for the Account audit trail (SCR-AUD-02) and its 403 state (STATE-AUTH-403 from=audit).
// Reference: screens/groups/06-account-governance/account-audit.html (scenario select + role) and 403.html?from=audit. Next: /{lang}/account/audit.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/account-audit.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed holds the reference's 13 records (backend/tmp-seed59.ts): owner Mohand Hatem, admin Sarah Ahmed, member Leo Karam. SEED is stale after cleanup.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/06-account-governance/";
  const NEXT = "http://localhost:3000";
  const PERSONA = {"owner": "acc-owner-msb1b@veyro-test.io", "admin": "acc-admin-msb1b@veyro-test.io", "member": "acc-member-msb1b@veyro-test.io"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("crumbs", ".bd-crumbs"), SAME("crumb-a1", ".bd-crumbs a:nth-of-type(1)"), SAME("crumb-a2", ".bd-crumbs a:nth-of-type(2)"), SAME("crumb-b", ".bd-crumbs b"),
    SAME("hero", ".au-hero"), SAME("hero-t", ".au-hero-t"), SAME("hero-h3", ".au-hero h3"), SAME("hero-li1", ".au-hero li:nth-child(1)"), SAME("hero-li3", ".au-hero li:nth-child(3)"), SAME("hero-ill", ".au-hero .il-illu"), SAME("hero-svg", ".au-hero svg"), SAME("stamp", ".au-hero svg text"),
    SAME("filters", ".au-filters"), SAME("frow1", ".au-frow1"), SAME("presets", ".au-presets"), SAME("chip1", ".au-presets .au-chip:nth-child(1)"), SAME("chip4", ".au-presets .au-chip:nth-child(4)"), SAME("chip-on", ".au-presets .au-chip.is-on"), SAME("reset", "#au-reset"),
    SAME("frow", ".au-frow"), SAME("f1", ".au-f:nth-child(1)"), SAME("f1-l", ".au-f:nth-child(1) span"), SAME("from", "#au-from"), SAME("to", "#au-to"),
    SAME("cats", ".au-cats"), SAME("cat1", ".au-cats .au-chip:nth-child(1)"), SAME("cat4", ".au-cats .au-chip:nth-child(4)"), SAME("cat-on", ".au-cats .au-chip[aria-pressed=true]"),
    SAME("list", ".au-list"), SAME("lh", ".au-list .ap-ch"), SAME("lh2", ".au-list h2"), SAME("total", "#au-total"), SAME("note", ".au-list .st-note"),
    SAME("th", ".au-th"), SAME("th1", ".au-th span:nth-child(1)"), SAME("th3", ".au-th span:nth-child(3)"),
    SAME("row1", ".au-row:nth-child(1)"), SAME("when1", ".au-row:nth-child(1) .au-when"), SAME("when1-b", ".au-row:nth-child(1) .au-when b"), SAME("when1-s", ".au-row:nth-child(1) .au-when small"), SAME("who1", ".au-row:nth-child(1) .au-who"), SAME("sys1", ".au-row:nth-child(1) .au-sys"), SAME("wn1", ".au-row:nth-child(1) .au-wn"),
    SAME("what1", ".au-row:nth-child(1) .au-what"), SAME("ic1", ".au-row:nth-child(1) .au-ic"), SAME("ic1-svg", ".au-row:nth-child(1) .au-ic svg"), SAME("tx1", ".au-row:nth-child(1) .au-tx"), SAME("tx1-b", ".au-row:nth-child(1) .au-tx b"),
    SAME("row2", ".au-row:nth-child(2)"), SAME("av2", ".au-row:nth-child(2) .st-av"), SAME("wn2", ".au-row:nth-child(2) .au-wn"), SAME("tx2", ".au-row:nth-child(2) .au-tx"), SAME("tx2-b", ".au-row:nth-child(2) .au-tx b"), SAME("row3", ".au-row:nth-child(3)"), SAME("row6", ".au-row:nth-child(6)"), SAME("tx6-b", ".au-row:nth-child(6) .au-tx b"),
    SAME("ic-billing", ".au-ic-billing"), SAME("ic-projects", ".au-ic-projects"), SAME("ic-ws", ".au-ic-workspaces"), SAME("ic-account", ".au-ic-account"),
    SAME("row-last", ".au-row:last-child"),
    SAME("d-sum", ".au-d summary"), SAME("d-dl", ".au-d[open] dl"), SAME("d-dt", ".au-d[open] dt"), SAME("d-dd", ".au-d[open] dd"),
    SAME("empty", ".au-empty:not([hidden])"), SAME("empty-b", ".au-empty b"), SAME("empty-p", ".au-empty p"), SAME("empty-btn", ".au-empty .pm-btn:not([hidden])"),
    SAME("pager", ".au-pager:not([hidden])"), SAME("range", "#au-range"), SAME("pbtns", ".au-pbtns"), SAME("prev", "#au-prev"), SAME("next", "#au-next"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
    SAME("gs", ".gs-card"), SAME("gs-text", ".gs-text"), SAME("gs-code", ".gs-code"), SAME("gs-h", "#gs-h"), SAME("gs-d", "#gs-d"), SAME("gs-hint", "#gs-hint"), SAME("gs-actions", ".gs-actions"), SAME("gs-home", "#gs-home"), SAME("gs-people", "#gs-people"), SAME("gs-ill", ".gs-ill"), SAME("gs-svg", ".gs-ill svg"),
  ];
  // range = nth preset chip, cats = nth category chips, next = clicks on Next, details = open the first row's Details
  const STATES = [
    { name: "full", role: "owner" },
    { name: "details", role: "owner", details: true },
    { name: "billing", role: "owner", cats: [1] },
    { name: "projects-account", role: "owner", cats: [2, 4] },
    { name: "range30", role: "owner", range: 3 },
    { name: "nomatch", role: "owner", cats: [2], range: 1 },
    { name: "page2", role: "owner", next: 1 },
    { name: "empty", role: "owner", scn: "empty" },
    { name: "error", role: "owner", scn: "error" },
    { name: "forbidden-admin", role: "admin", forbidden: true },
    { name: "forbidden-member", role: "member", forbidden: true },
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
    out.__rows = document.querySelectorAll(".au-row:not(.st-skel)").length;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st) => {
    if (st.range) { await page.click(`.au-presets .au-chip:nth-child(${st.range})`); await wait(2200); }
    for (const n of st.cats ?? []) { await page.click(`.au-cats .au-chip:nth-child(${n})`); await wait(2200); }
    for (let i = 0; i < (st.next ?? 0); i++) { await page.click("#au-next"); await wait(2200); }
    if (st.details) { await page.click(".au-row:nth-child(1) .au-d summary"); await wait(500); }
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      const url = st.forbidden ? `${REF}403.html?from=audit` : `${REF}account-audit.html`;
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role: st.role, c });
      await page.goto(url, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      if (st.scn) await page.selectOption("#au-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2800);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const ERR = /\/api\/v1\/audit-logs/;
      if (st.scn === "error") await page.route(ERR, (r) => r.abort());
      else if (st.scn === "empty") await page.route(ERR, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { logs: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } }) }));
      else await page.unroute(ERR).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/account/audit`, { waitUntil: "networkidle" });
      await page.waitForSelector(".au-row:not(.st-skel), .gs-card, .st-error, .au-empty:not([hidden])", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2800);
      await act(st);
      const B = await measure({ list: LIST.map((l) => [l[0], l[2]]), props: PROPS });

      // After paging the two pages end up scrolled by different amounts (the reference swaps rows for a skeleton while loading), so compare positions relative to the list card.
      const shift = st.next && A.list && B.list ? A.list.y - B.list.y : 0;
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
      report[key] = { rows: [A.__rows, B.__rows], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 60) };
    }
  }
  return report;
}
