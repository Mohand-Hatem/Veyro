// Parity Gate for onboarding and the invitation page.
// Reference: screens/groups/02-auth-onboarding/onboarding.html and invitation.html. Next: /{lang}/onboarding and /{lang}/invitations/accept.
// Run through the Playwright MCP (filename = this file) with the static server on :4173, the frontend on :3000 and the backend on :5000.
// SEED holds the throwaway users and invitation tokens created by the temporary seed script.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/02-auth-onboarding/";
  const NEXT = "http://localhost:3000";
  const SEED = {"sara": "fe45.sara.mvdyul5i@veyro-test.io", "leo": "fe45.leo.mvdyul5i@veyro-test.io", "newbie": "fe45.newbie.mvdyul5i@veyro-test.io", "eng": "fe45-eng-mvdyul5i", "tokens": {"valid": "eded8806176ad92386a62a4ce2fa5434682b475005ecdc428815aaddd57b7dee3ecb95f73ff34369b7e1e148fdd8d8c6", "expired": "b9c29e4cf68148329faf2c82c684f1d55fb96bdbc8234d82ffcba56ac92eaf26b7eadbd0338411824e3b97202b86ef68", "revoked": "637bfaf3e15f86b57d52c54a38642997f7e86ac872aa68261ca4ec4b0db4764c798051703b6861b8e8a345da747d1468", "accepted": "b70e22ba50fa5fbced4022b46cb6d0050e55a87a214b28d6baec3e2968df46e1b496e8efa7dc841a641272b3d29a8a0e", "mismatch": "c69693f5766f6eeb3af1e1475c631b28bd9d812dd168781d2d935095382645afdb823f62667ffc56aa9c96da5acaa354"}};
  const COMBOS = [{"w": 1440, "lang": "en", "theme": "light"}, {"w": 390, "lang": "en", "theme": "light"}, {"w": 390, "lang": "ar", "theme": "dark"}];
  const settle = () => page.waitForTimeout(1500);
  const SAME = (label, sel) => [label, sel, sel];

  const ONB = [
    SAME("shell", ".ob-shell"), SAME("top", ".ob-top"), SAME("brand", ".au-brand"), SAME("who", ".ob-who"), SAME("signout", "a.au-back"), SAME("theme-btn", "button.au-icon-btn"), SAME("lang-btn", ".au-tools .au-icon-btn:last-child"),
    SAME("head", ".ob-head"), SAME("h1", ".ob-head h1"), SAME("sub", ".ob-head .au-sub"), SAME("cards", ".ob-cards"),
    SAME("card1", ".ob-card:nth-child(1)"), SAME("card1-visual", ".ob-card:nth-child(1) .ob-visual"), SAME("card1-radio", ".ob-card:nth-child(1) .ob-radio"), SAME("card1-h2", ".ob-card:nth-child(1) h2"), SAME("card1-p", ".ob-card:nth-child(1) p"), SAME("card1-small", ".ob-card:nth-child(1) small"),
    SAME("card2", ".ob-card:nth-child(2)"), SAME("card2-visual", ".ob-card:nth-child(2) .ob-visual"), SAME("card3", ".ob-card:nth-child(3)"), SAME("card3-visual", ".ob-card:nth-child(3) .ob-visual"),
  ];
  const PAGES = [
    { name: "onb-a", who: "newbie", ref: `onboarding.html?name=Mohand&email=${SEED.newbie}`, next: "/onboarding", scope: ".ob-shell", list: [...ONB, SAME("panel", ".ob-panel"), SAME("panel-h2", ".ob-panel h2"), SAME("grid", ".ob-grid"), SAME("l-accountName", "label[for=accountName]"), SAME("accountName", "#accountName"), SAME("accountSlug", "#accountSlug"), SAME("workspaceName", "#workspaceName"), SAME("workspaceSlug", "#workspaceSlug"), SAME("hint", ".ob-hint"), SAME("submit", ".ob-btn"), SAME("note", ".ob-note")] },
    { name: "onb-b", who: "newbie", ref: `onboarding.html?name=Mohand&email=${SEED.newbie}`, next: "/onboarding", click: ".ob-card:nth-child(2)", scope: ".ob-shell", list: [...ONB, SAME("panel", ".ob-panel"), SAME("panel-h2", ".ob-panel h2"), SAME("l-invite", "label[for=invite]"), SAME("invite", "#invite"), SAME("submit", ".ob-btn"), SAME("note", ".ob-note")] },
    { name: "onb-c", who: "newbie", ref: `onboarding.html?name=Mohand&email=${SEED.newbie}`, next: "/onboarding", click: ".ob-card:nth-child(3)", scope: ".ob-shell", list: [...ONB, SAME("panel", ".ob-panel"), SAME("panel-h2", ".ob-panel h2"), SAME("lead", ".ob-lead"), SAME("submit", ".ob-btn"), SAME("note", ".ob-note")] },
  ];
  const INV = (name, refToken, nextToken, extra = {}) => ({
    name, who: "leo", ref: `invitation.html?token=${refToken}&workspace=Acme%20Engineering&by=Sara%20Ahmed&email=${SEED.leo}`, next: `/invitations/accept?token=${nextToken}`, scope: ".au-card", ...extra,
    list: [SAME("card", ".au-card"), SAME("state", ".inv-state:not([hidden])"), SAME("badge", ".au-badge"), SAME("h1", ".au-card h1"), SAME("sub", ".au-sub"), SAME("inv-card", ".inv-card"), SAME("ws-row", ".inv-ws-row"), SAME("ws-av", ".inv-ws-av"), SAME("role", ".inv-role"), SAME("dt1", "dt"), SAME("dd1", "dd"), SAME("note", ".inv-note"), SAME("accept", ".au-btn"), SAME("switch", ".au-switch"),
      SAME("done-icon", ".au-done-icon"), SAME("done-h2", ".au-done h2"), SAME("done-p", ".au-done p"), SAME("link", ".au-btn-link"), SAME("backlink", ".au-backlink"), SAME("email-b", ".au-email")],
  });
  PAGES.push(INV("inv-valid", "demo", SEED.tokens.valid), INV("inv-expired", "expired", SEED.tokens.expired), INV("inv-revoked", "expired", SEED.tokens.revoked), INV("inv-mismatch", "mismatch", SEED.tokens.mismatch), INV("inv-invalid", "invalid", "not-a-real-token"));
  PAGES.push(INV("inv-accepted", "demo", SEED.tokens.accepted, { refClick: "#inv-accept" }));

  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display"];
  const measure = (args) => page.evaluate(({ list, props, scope }) => {
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
        if (t && !/prototype|^valid$|^expired$|^email mismatch$|^not found$|^·$/i.test(t)) texts.add(t);
      }
    }
    out.__texts = [...texts];
    return out;
  }, args);

  const report = {};
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const pg of PAGES) {
      if (c.only && !c.only.includes(pg.name)) continue;
      const key = `${pg.name} ${c.w} ${c.lang} ${c.theme}`;
      // reference
      await page.goto(REF + pg.ref, { waitUntil: "load" });
      await page.evaluate((c) => { localStorage.setItem("veyro-theme", c.theme); localStorage.setItem("veyro-theme-pref", c.theme); localStorage.setItem("veyro-lang", c.lang); }, c);
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await page.evaluate(() => document.querySelector(".inv-proto")?.remove()); // reference-only state switcher
      await settle();
      if (pg.click) { await page.click(pg.click); await page.waitForTimeout(400); }
      if (pg.refClick) { await page.click(pg.refClick); await page.waitForTimeout(1500); }
      const A = await measure({ list: pg.list.map((l) => [l[0], l[1]]), props: PROPS, scope: pg.scope });
      // Next: sign in as the persona, then open the page
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, SEED[pg.who]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => localStorage.setItem("theme", c.theme), c);
      await page.goto(NEXT + "/" + c.lang + pg.next, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await settle();
      if (pg.click) { await page.click(pg.click); await page.waitForTimeout(400); }
      const B = await measure({ list: pg.list.map((l) => [l[0], l[2]]), props: PROPS, scope: pg.scope });

      const diffs = [];
      for (const [label] of pg.list) {
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
      const missing = A.__texts.filter((t) => !B.__texts.includes(t));
      const extra = B.__texts.filter((t) => !A.__texts.includes(t));
      if (diffs.length || missing.length || extra.length) report[key] = { missing, extra, n: diffs.length, diffs: diffs.slice(0, 14) };
      report.__checked = (report.__checked || 0) + 1;
    }
  }
  return report;
}
