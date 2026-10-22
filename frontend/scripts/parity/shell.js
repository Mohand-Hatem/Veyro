// Parity Gate for the application shell: sidebar, top bar, bottom dock and the three popovers.
// Reference: screens/groups/03-workspace-dashboard/index.html (role comes from sessionStorage "veyro-proto-role").
// Next: /{lang}/w/{slug}, signed in as the persona that matches the role. Run through the Playwright MCP (filename = this file)
// with the static server on :4173, the frontend on :3000 and the backend on :5000. SEED holds the throwaway test users.
async (page) => {
  const PROTO = "http://localhost:4173/screens/groups/03-workspace-dashboard/index.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"owner": "fe44.owner.mvdwraxz@veyro-test.io", "sarah": "fe44.sarah.mvdwraxz@veyro-test.io", "leo": "fe44.leo.mvdwraxz@veyro-test.io", "eng": "fe44-eng-mvdwraxz", "labs": "fe44-labs-mvdwraxz", "design": "fe44-design-mvdwraxz"};
  const COMBOS = [{"w": 1100, "lang": "ar", "theme": "dark", "role": "admin"}, {"w": 1100, "lang": "ar", "theme": "dark", "role": "admin"}, {"w": 1100, "lang": "ar", "theme": "dark", "role": "admin"}];
  const PERSONA = { owner: [SEED.owner, "owner"], admin: [SEED.sarah, "admin"], member: [SEED.leo, "member"] };
  const settle = () => page.waitForTimeout(1500);

  const SAME = (label, sel) => [label, sel, sel];
  const CLOSED = [
    SAME("page", ".app"), SAME("sidebar", ".ap-sb"), SAME("logo", ".ap-logo"), SAME("collapse", ".ap-collapse"),
    SAME("ws-btn", ".ap-ws"), SAME("ws-av", ".ap-ws-av"), SAME("ws-name", ".ap-ws-t b"), SAME("ws-role", ".ap-ws-t small"),
    SAME("create", ".ap-create"), SAME("create-icon", ".ap-create-ic"), SAME("nav", ".ap-nav"), SAME("nav-1", ".ap-nav a:nth-child(1)"), SAME("nav-2", ".ap-nav a:nth-child(2)"),
    SAME("nav-3", ".ap-nav a:nth-child(3)"), SAME("nav-4", ".ap-nav a:nth-child(4)"), SAME("nav-5", ".ap-nav a:nth-child(5)"), SAME("nav-6", ".ap-nav a:nth-child(6)"),
    SAME("help-guide", ".ap-help-guide"), SAME("help-contact", ".ap-help-contact"),
    SAME("topbar", ".ap-top"), SAME("burger", ".ap-burger"), SAME("title", ".ap-top h1"), SAME("search", ".ap-search"), SAME("search-input", ".ap-search input"), SAME("kbd", ".ap-search kbd"),
    SAME("ai-btn", ".ap-ai"), SAME("bell", ".ap-bell"), SAME("theme-btn", ".js-theme-toggle"), SAME("lang-btn", ".js-lang-toggle"),
    SAME("user", ".ap-user"), SAME("user-av", ".ap-user-av"), SAME("user-name", ".ap-user-t b"), SAME("user-role", ".ap-user-t small"),
    SAME("bottom-nav", ".ap-bn"), SAME("bottom-1", ".ap-bn a:nth-child(1)"), SAME("bottom-4", ".ap-bn a:nth-child(4)"),
  ];
  const STATES = [
    { name: "closed", click: null, scope: ".ap-sb, .ap-top, .ap-bn", list: CLOSED },
    { name: "ws", only: (c) => c.role === "admin" && c.w >= 1024, click: "#ap-ws", scope: ".ap-wsmenu", list: [SAME("wsmenu", ".ap-wsmenu"), SAME("wsm-label", ".ap-wsm-l"), SAME("wsm-item1", ".ap-wsm-i:nth-of-type(1)"), SAME("wsm-on", ".ap-wsm-i.on"), SAME("wsm-av", ".ap-wsm-i.on .ap-ws-av"), SAME("wsm-alt", ".ap-wsm-i:not(.on) .ap-ws-av"), SAME("wsm-new", ".ap-wsm-new")] },
    { name: "user", only: (c) => c.w >= 768, click: ".ap-user", scope: ".ap-umenu", list: [SAME("umenu", ".ap-umenu"), SAME("um-head", ".ap-um-head"), SAME("um-av", ".ap-um-head .ap-user-av"), SAME("um-who", ".ap-um-who"), SAME("um-item", ".ap-um-i"), SAME("um-out", ".ap-um-i.is-out")] },
    { name: "collapsed", only: (c) => c.w >= 1280, click: ".ap-collapse", scope: ".ap-sb", list: [SAME("sidebar", ".ap-sb"), SAME("logo", ".ap-logo"), SAME("ws-btn", ".ap-ws"), SAME("create", ".ap-create"), SAME("nav-1", ".ap-nav a:nth-child(1)"), SAME("nav-2", ".ap-nav a:nth-child(2)"), SAME("help-guide", ".ap-help-guide"), SAME("title", ".ap-top h1")] },
    { name: "drawer", only: (c) => c.w < 1024, click: ".ap-burger", scope: ".ap-sb", list: [SAME("sidebar", ".ap-sb"), SAME("logo", ".ap-logo"), SAME("ws-btn", ".ap-ws"), SAME("nav-1", ".ap-nav a:nth-child(1)"), SAME("acct", ".ap-sb-acct"), SAME("acct-link", ".ap-sb-acct a"), SAME("acct-out", ".ap-sb-acct button"), SAME("help-guide", ".ap-help-guide")] },
    { name: "bell", only: (c) => c.w >= 768, click: "#ap-bell", scope: ".ap-bellpop", list: [SAME("bellpop", ".ap-bellpop"), SAME("soon", ".ap-soon"), SAME("bell-title", ".ap-bellpop b"), SAME("bell-text", ".ap-bellpop p")] },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display"];
  // reference-only demo content (prototype toolbar, invented email) and the placeholder dashboard are excluded from the text diff
  const SKIP_TEXT = /prototype/i;

  const measure = (args) => page.evaluate(({ list, props, scope, skip }) => {
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
    const texts = new Set();
    for (const root of document.querySelectorAll(scope)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode, el = n.parentElement;
        if (!el || el.closest("svg")) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === "hidden") continue;
        const t = n.textContent.replace(/\s+/g, " ").trim();
        if (t && !new RegExp(skip, "i").test(t)) texts.add(t);
      }
    }
    out.__texts = [...texts];
    return out;
  }, args);

  const report = {};
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    // sign in to Next once per persona (cookies are first-party on :3000)
    await page.context().clearCookies();
    await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
    const [email] = PERSONA[c.role];
    const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, email);
    if (ok !== 200) { report[`login-${c.role}`] = `login failed ${ok}`; continue; }
    for (const st of STATES) {
      if (st.only && !st.only(c)) continue;
      const key = `${st.name} ${c.role} ${c.w} ${c.lang} ${c.theme}`;
      // reference
      await page.goto(PROTO, { waitUntil: "load" });
      await page.evaluate((c) => { sessionStorage.setItem("veyro-proto-role", c.role); sessionStorage.setItem("veyro-tasks-proto", ""); localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.addStyleTag({ content: "html{overflow-y:scroll}" }); // the reference page is taller; equalise the scrollbar
      await settle();
      if (st.click) { await page.click(st.click); await page.waitForTimeout(400); }
      const A = await measure({ list: st.list.map((l) => [l[0], l[1]]), props: PROPS, scope: st.scope, skip: SKIP_TEXT.source });
      // Next
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}`, { waitUntil: "networkidle" });
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector(".ap-user-t b:not(:empty)", { timeout: 10000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await settle();
      if (st.click) { await page.click(st.click); await page.waitForTimeout(400); }
      const B = await measure({ list: st.list.map((l) => [l[0], l[2]]), props: PROPS, scope: st.scope, skip: SKIP_TEXT.source });

      const diffs = [];
      for (const [label] of st.list) {
        const a = A[label], b = B[label];
        if (!a && !b) continue;
        if (!a) { diffs.push(`${label}: only in Next`); continue; }
        if (!b) { diffs.push(`${label}: MISSING in Next`); continue; }
        for (const p of PROPS) {
          if (p === "borderTopColor" && a.borderTopWidth === "0px" && b.borderTopWidth === "0px") continue;
          if (a[p] !== b[p]) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
        }
        for (const p of ["x", "y", "w", "h"]) if (!(label === "page" && p === "h") && Math.abs(a[p] - b[p]) > 1) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
      }
      const missing = A.__texts.filter((t) => !B.__texts.includes(t));
      const extra = B.__texts.filter((t) => !A.__texts.includes(t));
      if (diffs.length || missing.length || extra.length) report[key] = { missing, extra, n: diffs.length, diffs: diffs.slice(0, 14) };
      report.__checked = (report.__checked || 0) + 1;
    }
  }
  return report;
}
