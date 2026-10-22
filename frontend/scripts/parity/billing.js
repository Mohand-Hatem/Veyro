// Parity Gate for the Billing page (SCR-SET-02) and the 403 state (STATE-AUTH-403), content area only.
// Reference: screens/groups/06-account-governance/billing.html (scenario select) and 403.html?from=billing. Next: /{lang}/account/billing.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/billing.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// SEED holds one throwaway owner per scenario (stale after cleanup; re-seed with tmp-seed57.ts to reuse).
async (page) => {
  const REF = "http://localhost:4173/screens/groups/06-account-governance/";
  const NEXT = "http://localhost:3000";
  const SEED = {"pro": "bill-pro-csmt4@veyro-test.io", "pastdue": "bill-pastdue-csmt4@veyro-test.io", "graceover": "bill-graceover-csmt4@veyro-test.io", "select": "bill-select-csmt4@veyro-test.io", "free": "bill-free-csmt4@veyro-test.io", "offboarding": "bill-offboarding-csmt4@veyro-test.io", "admin": "bill-admin-csmt4@veyro-test.io", "member": "bill-member-csmt4@veyro-test.io"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("crumbs", ".bd-crumbs"), SAME("crumb-a", ".bd-crumbs a"), SAME("crumb-b", ".bd-crumbs b"),
    SAME("banner", ".gv-banner:not([hidden])"), SAME("banner-svg", ".gv-banner svg"), SAME("banner-b", ".gv-banner b"), SAME("banner-p", ".gv-banner p"), SAME("banner-btn", ".gv-banner .pm-btn"),
    SAME("plan", ".gv-plan"), SAME("eyebrow", ".gv-eyebrow"), SAME("pname", ".gv-plan-name"), SAME("pname-h", ".gv-plan-name h2"), SAME("status", "#gv-status"), SAME("meta", "#gv-meta"), SAME("actions", ".gv-actions"), SAME("change", "#gv-change"), SAME("audit", "#gv-audit-link"), SAME("hint", ".gv-plan .pm-hint"),
    SAME("meters", "#gv-meters"), SAME("m1", ".gv-meter:nth-child(1)"), SAME("m1-l", ".gv-meter:nth-child(1) .gv-ml"), SAME("m1-b", ".gv-meter:nth-child(1) b"), SAME("m1-s", ".gv-meter:nth-child(1) .gv-ml span"), SAME("m1-bar", ".gv-meter:nth-child(1) .gv-bar"), SAME("m1-i", ".gv-meter:nth-child(1) .gv-bar i"), SAME("m2", ".gv-meter:nth-child(2)"), SAME("m2-s", ".gv-meter:nth-child(2) .gv-ml span"), SAME("m2-i", ".gv-meter:nth-child(2) .gv-bar i"), SAME("full", ".gv-meter.is-full .gv-bar i"), SAME("ro", ".gv-ro"), SAME("ro-st", ".gv-ro .ap-st"),
    SAME("plans", ".gv-plans"), SAME("sh", ".gv-sh"), SAME("sh-h3", ".gv-sh h3"), SAME("sh-p", ".gv-sh p"), SAME("pgrid", ".gv-pgrid"), SAME("pc1", ".gv-pc:nth-child(1)"), SAME("pc1-h", ".gv-pc:nth-child(1) h4"), SAME("pc1-price", ".gv-pc:nth-child(1) .gv-price"), SAME("pc1-ul", ".gv-pc:nth-child(1) ul"), SAME("pc1-b", ".gv-pc:nth-child(1) li b"), SAME("pc1-btn", ".gv-pc:nth-child(1) .pm-btn"), SAME("pc2", ".gv-pc:nth-child(2)"), SAME("pc4", ".gv-pc:nth-child(4)"), SAME("pc4-li2", ".gv-pc:nth-child(4) li:nth-child(2)"), SAME("cur", ".gv-pc.is-cur"), SAME("curtag", ".gv-curtag"), SAME("cur-btn", ".gv-pc.is-cur .pm-btn"),
    SAME("hist", ".gv-hist"), SAME("hist-h", ".gv-hist .ap-ch"), SAME("hh", ".gv-hh"), SAME("hh1", ".gv-hh span:nth-child(1)"), SAME("hr1", ".gv-hr:nth-child(2)"), SAME("hr1-d", ".gv-hr:nth-child(2) span:nth-child(1)"), SAME("hr1-e", ".gv-hr:nth-child(2) span:nth-child(2)"), SAME("dot", ".gv-dot"), SAME("dot-bad", ".gv-dot.is-bad"), SAME("hr3", ".gv-hr:nth-child(4)"),
    SAME("hempty", ".gv-hempty:not([hidden])"), SAME("hempty-ill", ".gv-hempty .ap-empty-ill"), SAME("hempty-h2", ".gv-hempty h2"), SAME("hempty-p", ".gv-hempty p"),
    SAME("danger", ".gv-danger"), SAME("dz-h2", ".gv-danger h2"), SAME("dz-p", ".gv-danger p"), SAME("dz-btn", "#gv-del-open"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
    SAME("gs", ".gs-card"), SAME("gs-text", ".gs-text"), SAME("gs-code", ".gs-code"), SAME("gs-h", "#gs-h"), SAME("gs-d", "#gs-d"), SAME("gs-hint", "#gs-hint"), SAME("gs-actions", ".gs-actions"), SAME("gs-home", "#gs-home"), SAME("gs-people", "#gs-people"), SAME("gs-ill", ".gs-ill"), SAME("gs-svg", ".gs-ill svg"),
  ];
  const STATES = [
    { name: "pro", scn: "pro" },
    { name: "pastdue", scn: "pastdue" },
    { name: "graceover", scn: "graceover" },
    { name: "select", scn: "select" },
    { name: "free", scn: "free" },
    { name: "offboarding", scn: "offboarding" },
    { name: "error", scn: "error", persona: "pro" },
    { name: "forbidden-admin", role: "admin", forbidden: true, persona: "admin" },
    { name: "forbidden-member", role: "member", forbidden: true, persona: "member" },
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
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      const url = st.forbidden ? `${REF}403.html?from=billing` : `${REF}billing.html`;
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role: st.role ?? "owner", c });
      await page.goto(url, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      if (st.scn && st.scn !== "pro") await page.selectOption("#gv-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(3000);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const email = SEED[st.persona ?? st.scn];
      const ok = await page.evaluate(async (e) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "Passw0rd!long" }) })).status, email);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const ERR = /\/api\/v1\/accounts\/[^/]+\/subscription/;
      if (st.scn === "error") await page.route(ERR, (r) => r.abort());
      else await page.unroute(ERR).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/account/billing`, { waitUntil: "networkidle" });
      await page.waitForSelector(".gv-plan, .gs-card, .st-error", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(3000);
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
      report[key] = { rows: [0, 0], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
