// Parity Gate for the Audit trail (SCR-AUD-01).
// Reference: screens/groups/03-workspace-dashboard/audit.html. Next: /{lang}/w/{slug}/audit.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/audit.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed must use the reference's own people and emails (mohand@acme.io, ...) and its 60 audit records: it refuses to run if the users exist. SEED.slug is stale after cleanup.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/audit.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"slug": "acme-eng-phize4"};
  const PERSONA = { owner: "mohand@acme.io", admin: "sarah@acme.io", member: "leo@acme.io" };
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("sub", ".ap-ovh h2"),
    SAME("hero", ".au-hero"), SAME("hero-t", ".au-hero-t"), SAME("hero-h3", ".au-hero h3"), SAME("hero-li1", ".au-hero li:nth-child(1)"), SAME("hero-li3", ".au-hero li:nth-child(3)"), SAME("hero-ill", ".au-hero .il-illu"), SAME("hero-svg", ".au-hero svg"),
    SAME("filters", ".au-filters"), SAME("frow1", ".au-frow1"), SAME("presets", ".au-presets"), SAME("chip1", ".au-presets .au-chip:nth-child(1)"), SAME("chip2", ".au-presets .au-chip:nth-child(2)"), SAME("chip4", ".au-presets .au-chip:nth-child(4)"), SAME("chip-on", ".au-presets .au-chip.is-on"), SAME("reset", "#au-reset"),
    SAME("frow", ".au-frow"), SAME("f1", ".au-f:nth-child(1)"), SAME("f1-l", ".au-f:nth-child(1) span"), SAME("from", "#au-from"), SAME("to", "#au-to"), SAME("actor", "#au-actor"), SAME("proj", "#au-proj"),
    SAME("cats", ".au-cats"), SAME("cat1", ".au-cats .au-chip:nth-child(1)"), SAME("cat-on", ".au-cats .au-chip[aria-pressed=true]"),
    SAME("list", ".au-list"), SAME("lh", ".au-list .ap-ch"), SAME("lh2", ".au-list h2"), SAME("total", "#au-total"), SAME("note", ".au-list .st-note"),
    SAME("th", ".au-th"), SAME("th1", ".au-th span:nth-child(1)"), SAME("th3", ".au-th span:nth-child(3)"),
    SAME("row1", ".au-row:nth-child(1)"), SAME("when1", ".au-row:nth-child(1) .au-when"), SAME("when1-b", ".au-row:nth-child(1) .au-when b"), SAME("when1-s", ".au-row:nth-child(1) .au-when small"), SAME("who1", ".au-row:nth-child(1) .au-who"), SAME("av1", ".au-row:nth-child(1) .st-av"), SAME("wn1", ".au-row:nth-child(1) .au-wn"),
    SAME("what1", ".au-row:nth-child(1) .au-what"), SAME("ic1", ".au-row:nth-child(1) .au-ic"), SAME("ic1-svg", ".au-row:nth-child(1) .au-ic svg"), SAME("tx1", ".au-row:nth-child(1) .au-tx"), SAME("tx1-b", ".au-row:nth-child(1) .au-tx b"), SAME("tx1-k", ".au-row:nth-child(1) .au-tx .ap-key"),
    SAME("row2", ".au-row:nth-child(2)"), SAME("row3", ".au-row:nth-child(3)"), SAME("row4", ".au-row:nth-child(4)"), SAME("ic-people", ".au-ic-people"), SAME("ic-projects", ".au-ic-projects"), SAME("ic-tasks", ".au-ic-tasks"), SAME("ic-ws", ".au-ic-workspace"), SAME("sys", ".au-sys"),
    SAME("row-last", ".au-row:last-child"),
    SAME("d-sum", ".au-d summary"), SAME("d-dl", ".au-d[open] dl"), SAME("d-dt", ".au-d[open] dt"), SAME("d-dd", ".au-d[open] dd"),
    SAME("empty", ".au-empty:not([hidden])"), SAME("empty-b", ".au-empty b"), SAME("empty-p", ".au-empty p"), SAME("empty-btn", ".au-empty .pm-btn:not([hidden])"),
    SAME("pager", ".au-pager:not([hidden])"), SAME("range", "#au-range"), SAME("pbtns", ".au-pbtns"), SAME("prev", "#au-prev"), SAME("next", "#au-next"),
    SAME("denied", ".st-denied"), SAME("denied-ill", ".st-denied .ap-empty-ill"), SAME("denied-h2", ".st-denied h2"), SAME("denied-p", ".st-denied p"), SAME("denied-btn", ".st-denied .st-back"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
  ];
  const STATES = [
    { name: "all", role: "admin" },
    { name: "owner", role: "owner" },
    { name: "denied", role: "member" },
    { name: "error", role: "admin", scn: "error" },
    { name: "empty", role: "admin", scn: "empty" },
    { name: "details", role: "admin", detailsOpen: true },
    { name: "tasks", role: "admin", cats: [3] },
    { name: "people-projects", role: "admin", cats: [1, 2] },
    { name: "person", role: "admin", actor: "Sarah Ahmed" },
    { name: "project", role: "admin", proj: "Billing Console" },
    { name: "deleted-project", role: "admin", proj: "Legacy API Cleanup" },
    { name: "nomatch", role: "admin", cats: [2], proj: "Billing Console" },
    { name: "page2", role: "admin", next: 1 },
    { name: "last-page", role: "admin", next: 3 },
    { name: "range30", role: "admin", range: 4 },
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
    if (st.range) { await page.click(`.au-presets .au-chip:nth-child(${st.range})`); await wait(1800); }
    for (const n of st.cats ?? []) { await page.click(`.au-cats .au-chip:nth-child(${n})`); await wait(1800); }
    const pick = async (sel, text) => { // the option whose text starts with `text` (deleted projects carry a "(deleted)" suffix that is translated)
      const v = await page.evaluate(([s, t]) => [...document.querySelectorAll(`${s} option`)].find((o) => o.textContent.trim().startsWith(t))?.value, [sel, text]);
      await page.selectOption(sel, v);
      await wait(1800);
    };
    if (st.actor) await pick("#au-actor", st.actor);
    if (st.proj) await pick("#au-proj", st.proj);
    for (let i = 0; i < (st.next ?? 0); i++) { await page.click("#au-next"); await wait(1800); }
    if (st.detailsOpen) { await page.click(".au-row:nth-child(1) .au-d summary"); await wait(500); }
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
      await page.reload({ waitUntil: "load" });
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
      else if (st.scn === "empty") await page.route(ERR, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { logs: [], meta: { total: 0, page: 1, limit: 15, totalPages: 0 } } }) }));
      else await page.unroute(ERR).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.slug}/audit`, { waitUntil: "networkidle" });
      await page.waitForSelector(".au-row:not(.st-skel), .st-denied, .st-error, .au-empty:not([hidden])", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2800);
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
      report[key] = { rows: [A.__rows, B.__rows], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
