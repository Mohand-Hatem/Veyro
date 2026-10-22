// Parity Gate for the public landing page (SCR-MKT-01), step 4.17a.
// Reference: screens/groups/01-public-marketing/index.html. Next: /{lang}. Nothing needs a backend or a sign-in (the page is public; the visitor is signed out).
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/landing.js
// The static server must be on :4173 and the frontend on :3000. Motion is switched off (reduced-motion) so geometry is stable.
// Known, explained differences (claims checked against the product while porting): the role count (3 -> 4), two marquee chips (Google/GitHub sign-in -> English and Arabic, light and dark),
// the dashboard mock's third card (AI proposals -> AI messages today), the roles matrix rows, the roles notes, and the contact section (the reference's prototype form -> a pointer to the real Contact page).
// The features section is empty until step 4.17b (the bento grid).
async (page) => {
  const REF = "http://localhost:4173/screens/groups/01-public-marketing/index.html";
  const NEXT = "http://localhost:3000";
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const S = (k) => `main > section:nth-of-type(${k})`;
  const LIST = [
    SAME("nav", ".mk-nav"), SAME("nav-in", ".mk-nav-inner"), SAME("brand", ".mk-nav .mk-brand"), SAME("brand-img", ".mk-nav .mk-brand img"), SAME("links", ".mk-nav-links"),
    ...[1, 2, 3, 4, 5, 6, 7].map((k) => SAME(`link${k}`, `.mk-nav-links a:nth-child(${k})`)),
    SAME("icon1", ".mk-nav-actions .mk-icon-btn:nth-of-type(1)"), SAME("icon2", ".mk-nav-actions .mk-lang-btn"), SAME("signin", ".mk-link-signin"), SAME("start", ".mk-nav-actions .mk-btn"), SAME("menu", ".mk-menu-btn"),
    SAME("drawer", ".mk-drawer.open"), SAME("drawer-a1", ".mk-drawer.open > a:nth-child(1)"), SAME("drawer-act", ".mk-drawer.open .mk-drawer-actions"),
    SAME("hero", ".mk-hero"), SAME("hero-grid", ".mk-hero-grid"), SAME("h1", ".mk-hero h1"), SAME("scribble", ".mk-scribble"), SAME("sub", ".mk-hero-sub"), SAME("capsule", ".mk-capsule"), SAME("cap-in", ".mk-capsule input"), SAME("cap-btn", ".mk-capsule-btn"),
    SAME("stats", ".mk-stats"), SAME("stat1", ".mk-stat:nth-child(1)"), SAME("stat1-b", ".mk-stat:nth-child(1) b"), SAME("stat1-s", ".mk-stat:nth-child(1) span"), SAME("stat2", ".mk-stat:nth-child(2)"), SAME("stat-foot", ".mk-stat-foot"), SAME("iso", ".mk-iso"),
    SAME("mq", ".mk-marquee"), SAME("mq-l", ".mk-mq-label"), SAME("mq-row1", ".mk-mq-left"), SAME("mq-1", ".mk-mq-left li:nth-child(1)"), SAME("mq-3", ".mk-mq-left li:nth-child(3)"), SAME("mq-row2", ".mk-mq-right"), SAME("mq2-1", ".mk-mq-right li:nth-child(1)"), SAME("mq2-3", ".mk-mq-right li:nth-child(3)"),
    SAME("wf", ".mk-wf"), SAME("wf-grid", ".mk-wf-grid"), SAME("wf-panel", ".mk-wf-panel"), SAME("wf-svg", ".mk-wf-panel svg"), SAME("wf-h2", ".mk-wf-copy h2"), SAME("wf-lead", ".mk-wf-copy .mk-lead"),
    ...[1, 2, 3].flatMap((k) => [SAME(`wf-li${k}`, `.mk-wf-list li:nth-child(${k})`), SAME(`wf-ic${k}`, `.mk-wf-list li:nth-child(${k}) .mk-wf-ic`), SAME(`wf-h${k}`, `.mk-wf-list li:nth-child(${k}) h3`), SAME(`wf-p${k}`, `.mk-wf-list li:nth-child(${k}) p`)]), SAME("wf-btn", ".mk-wf-copy .mk-btn"),
    SAME("show", ".mk-show"), SAME("show-h2", ".mk-show h2"), SAME("show-lead", ".mk-show .mk-lead"), SAME("stage", ".mk-stage"), SAME("dash", ".mk-dash"), SAME("rail", ".mk-rail"), SAME("dash-main", ".mk-dash-main"), SAME("kicker", ".mk-dash-kicker"), SAME("dash-t", ".mk-dash-title"), SAME("kpis", ".mk-kpis"),
    ...[1, 2, 3, 4].flatMap((k) => [SAME(`kpi${k}`, `.mk-kpi:nth-child(${k})`), SAME(`kpi${k}-s`, `.mk-kpi:nth-child(${k}) span`), SAME(`kpi${k}-b`, `.mk-kpi:nth-child(${k}) b`), SAME(`kpi${k}-m`, `.mk-kpi:nth-child(${k}) small`)]),
    SAME("dash-cols", ".mk-dash-cols"), SAME("panel1", ".mk-dash-cols .mk-panel:nth-child(1)"), SAME("bars", ".mk-bars"), SAME("panel2", ".mk-dash-cols .mk-panel:nth-child(2)"), SAME("person1", ".mk-person:nth-of-type(1)"), SAME("panel3", ".mk-panel-wide"), SAME("prow1", ".mk-prow:nth-child(2)"), SAME("phone", ".mk-phone"), SAME("phone-card", ".mk-phone-card"),
    SAME("how", "#how-it-works"), SAME("how-h2", "#how-it-works h2"), SAME("steps", ".mk-steps"),
    ...[1, 2, 3].flatMap((k) => [SAME(`step${k}`, `.mk-step:nth-child(${k})`), SAME(`step${k}-v`, `.mk-step:nth-child(${k}) .mk-step-visual`), SAME(`step${k}-h`, `.mk-step:nth-child(${k}) h3`), SAME(`step${k}-p`, `.mk-step:nth-child(${k}) > p`)]),
    SAME("feat", "#features"), SAME("feat-pill", ".mk-pill"), SAME("feat-h2", "#features h2"),
    SAME("roles", "#roles"), SAME("roles-h2", "#roles h2"), SAME("roles-lead", "#roles .mk-lead"), SAME("matrix", ".mk-matrix"), SAME("m-th1", ".mk-matrix thead th:nth-child(1)"), SAME("m-th4", ".mk-matrix thead th:nth-child(4)"),
    ...[1, 2, 3, 4, 5, 6].flatMap((k) => [SAME(`m-r${k}`, `.mk-matrix tbody tr:nth-child(${k})`), SAME(`m-r${k}-h`, `.mk-matrix tbody tr:nth-child(${k}) th`), SAME(`m-r${k}-c2`, `.mk-matrix tbody tr:nth-child(${k}) td:nth-of-type(2) span`)]), SAME("roles-note", "#roles .mk-note"),
    SAME("ai", "#ai"), SAME("ai-grid", ".mk-ai-grid"), SAME("ai-h2", "#ai h2"), SAME("ai-lead", "#ai .mk-lead"), SAME("checks", ".mk-checks"), SAME("check1", ".mk-checks li:nth-child(1)"), SAME("demo", ".mk-ai-demo"), SAME("ai-msg", ".mk-ai-msg"), SAME("ai-card", ".mk-ai-card"), SAME("ai-card-h", ".mk-ai-card-head"), SAME("ai-card-p", ".mk-ai-card p"), SAME("ai-dl", ".mk-ai-card dl"), SAME("ai-act", ".mk-ai-actions"), SAME("ai-confirm", "#ai-confirm"), SAME("ai-reject", "#ai-reject"), SAME("ai-result", ".mk-ai-result:not([hidden])"), SAME("ai-reset", ".mk-ai-reset:not([hidden])"),
    SAME("about", "#about"), SAME("about-pill", "#about .mk-pill"), SAME("about-h2", "#about h2"), SAME("cases", ".mk-cases"),
    ...[1, 2, 3].flatMap((k) => [SAME(`case${k}`, `.mk-case:nth-child(${k})`), SAME(`case${k}-v`, `.mk-case:nth-child(${k}) .mk-case-visual`), SAME(`case${k}-h`, `.mk-case:nth-child(${k}) h3`), SAME(`case${k}-p`, `.mk-case:nth-child(${k}) > p`)]),
    SAME("contact", "#contact"), SAME("c-card", ".mk-contact-card"), SAME("c-left", ".mk-contact-left"), SAME("c-h2", "#contact h2"), SAME("c-lead", "#contact .mk-lead"),
    SAME("footer", ".mk-footer"), SAME("foot-cta", ".mk-footer-cta"), SAME("foot-h2", ".mk-footer-cta h2"), SAME("foot-btn", ".mk-footer-cta .mk-btn"), SAME("foot-bar", ".mk-footer-bar"), SAME("foot-nav", ".mk-footer-bar nav"), SAME("foot-a1", ".mk-footer-bar nav a:nth-child(1)"), SAME("toggles", ".mk-toggles"), SAME("tog1", ".mk-toggle:nth-child(1)"), SAME("tog2", ".mk-toggle:nth-child(2)"), SAME("copy", ".mk-copy"),
  ];
  // scroll = scrollY before measuring, drawer = open the phone drawer, ai = click Confirm or Reject in the AI demo
  const STATES = [
    { name: "top" },
    { name: "scrolled", scroll: 600 },
    { name: "drawer", drawer: true },
    { name: "ai-confirm", ai: "#ai-confirm" },
    { name: "ai-reject", ai: "#ai-reject" },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity", "fill", "stroke", "backdropFilter"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props }) => {
    const find = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })[0] || null;
    const out = {};
    for (const [label, sel] of list) {
      const el = find(sel);
      if (!el) { out[label] = null; continue; }
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const o = { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
      for (const p of props) o[p] = p === "fontFamily" ? cs[p].split(",")[0].replace(/["']/g, "").trim() : cs[p];
      out[label] = o;
    }
    const texts = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("svg") && el.tagName !== "text") continue;
      if (el.closest(".mk-mq-set[aria-hidden]") || el.closest("script, style")) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden") continue;
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t && !/^Prototype/i.test(t)) texts.push(t);
    }
    out.__texts = texts;
    out.__sections = [...document.querySelectorAll("main > section")].map((s) => Math.round(s.getBoundingClientRect().height));
    out.__nav = document.querySelector(".mk-nav").className.replace(/\s+/g, " ").trim();
    out.__expanded = document.querySelector(".mk-menu-btn")?.getAttribute("aria-expanded") ?? null;
    out.__scrollH = document.documentElement.scrollHeight;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st, c) => {
    if (st.scroll) { await page.evaluate((y) => window.scrollTo(0, y), st.scroll); await wait(900); }
    if (st.drawer) { if (c.w > 1024) return false; await page.click(".mk-menu-btn"); await wait(700); }
    if (st.ai) { await page.locator("#ai").scrollIntoViewIfNeeded(); await wait(300); await page.click(st.ai); await wait(500); }
    return true;
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      if (st.drawer && c.w > 1024) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => { localStorage.setItem("veyro-theme", a.theme); localStorage.setItem("veyro-lang", a.lang); }, c);
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await wait(2000);
      await act(st, c);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}`, { waitUntil: "networkidle" });
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); }, c);
      await page.goto(`${NEXT}/${c.lang}`, { waitUntil: "networkidle" });
      await wait(2500);
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
      report[key] = { nav: [A.__nav, B.__nav], expanded: [A.__expanded, B.__expanded], sections: [A.__sections, B.__sections], scrollH: [A.__scrollH, B.__scrollH], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 60) };
    }
  }
  return report;
}
