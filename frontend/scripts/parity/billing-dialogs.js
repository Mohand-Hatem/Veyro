// Parity Gate for the two Billing dialogs: choose the editable projects (SCR-SET-03) and delete the account (SCR-SET-04).
// Reference: screens/groups/06-account-governance/billing.html (scenario "select"; dialogs open from #gv-open-sel and #gv-del-open). Next: /{lang}/account/billing.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/billing-dialogs.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed account must have the reference's data (slug acme-corp-prod, five projects with 21/14/9/17/6 tasks, all read-only): backend/tmp-seed58.ts "par". SEED is stale after cleanup.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/06-account-governance/billing.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"email": "dlg-par-f9pb6@veyro-test.io"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  // The server lists projects by workspace then name; the reference lists them in creation order, so rows are matched by project key.
  const ROW = { AUT: [1, 3], BIL: [2, 4], MOB: [3, 5], DSN: [4, 2], BRD: [5, 1] };
  const rows = Object.entries(ROW).flatMap(([k, [r, n]]) => [
    [`row-${k}`, `.gv-p:nth-child(${r})`, `.gv-p:nth-child(${n})`],
    [`row-${k}-key`, `.gv-p:nth-child(${r}) .ap-key`, `.gv-p:nth-child(${n}) .ap-key`],
    [`row-${k}-name`, `.gv-p:nth-child(${r}) .gv-pn b`, `.gv-p:nth-child(${n}) .gv-pn b`],
    [`row-${k}-meta`, `.gv-p:nth-child(${r}) small`, `.gv-p:nth-child(${n}) small`],
    [`row-${k}-box`, `.gv-p:nth-child(${r}) input`, `.gv-p:nth-child(${n}) input`],
  ]);
  const LIST = [
    SAME("dlg", "dialog[open]"), SAME("form", ".pm-form"), SAME("main", ".pm-main"), SAME("head", ".pm-head"), SAME("h2", ".pm-head h2"), SAME("sub", ".pm-head p"), SAME("x", ".pm-x"), SAME("alert", ".pm-alert:not([hidden])"),
    SAME("group", ".pm-f[role=group]"), SAME("lrow", ".pm-lrow"), SAME("lbl", ".pm-lrow .iv-lbl"), SAME("count", "#gvs-count"), SAME("plist", "#gvs-list"), ...rows, SAME("hint", ".pm-hint"),
    SAME("list", ".gvd-list"), SAME("li1", ".gvd-list li:nth-child(1)"), SAME("li3", ".gvd-list li:nth-child(3)"),
    SAME("f-slug", "#gvd-f-slug"), SAME("l-slug", "#gvd-f-slug label"), SAME("slug-hint", "#gvd-slug-hint"), SAME("in-slug", "#gvd-slug"), SAME("f-pw", "#gvd-f-pw"), SAME("l-pw", "#gvd-f-pw label"), SAME("in-pw", "#gvd-pw"), SAME("err-pw", "#gvd-pw-e:not([hidden])"),
    SAME("foot", ".pm-foot"), SAME("cancel", ".pm-foot .pm-ghost"), SAME("go", ".pm-foot button[type=submit]"),
    SAME("side", ".gv-side"), SAME("illu", ".gv-side .il-illu"), SAME("svg", ".gv-side svg"), SAME("svg-cnt", "#gvs-svg-cnt"), SAME("slot1", "#gvs-slots > :nth-child(1)"), SAME("slot3", "#gvs-slots > :nth-child(3)"),
    SAME("caps", ".gv-side .il-caps"), SAME("cap-on", ".gv-side .il-cap.is-on"), SAME("pager", ".gv-side .il-pager"), SAME("dot-on", ".gv-side .il-pager button.is-on"),
  ];
  const STATES = [
    { name: "sel-empty", kind: "sel" },
    { name: "sel-two", kind: "sel", pick: ["AUT", "BRD"] },
    { name: "sel-full", kind: "sel", pick: ["AUT", "BIL", "DSN"] },
    { name: "del-empty", kind: "del" },
    { name: "del-typed", kind: "del", slug: "acme-corp-prod", pw: "Passw0rd!long" },
    { name: "del-slug-half", kind: "del", slug: "acme-corp", pw: "x" },
    { name: "del-wrong", kind: "del", slug: "acme-corp-prod", pw: "wrong", submit: true },
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
    out.__checked = [...root.querySelectorAll("input[type=checkbox]:checked")].map((i) => i.closest("label").querySelector(".ap-key").textContent).sort().join(",");
    out.__goDisabled = root.querySelector(".pm-foot button[type=submit]")?.disabled ?? null;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st) => {
    await page.click(st.kind === "sel" ? "#gv-open-sel" : "#gv-del-open");
    await page.waitForSelector("dialog[open]", { timeout: 15000 });
    await wait(900);
    for (const k of st.pick ?? []) await page.locator("dialog[open] .gv-p", { hasText: new RegExp(`^\\s*${k}`) }).locator("input").check();
    if (st.slug) await page.fill("dialog[open] #gvd-slug", st.slug);
    if (st.pw) await page.fill("dialog[open] #gvd-pw", st.pw);
    if (st.submit) { await page.click("dialog[open] #gvd-go"); await wait(6000); }
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
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", "owner"); localStorage.setItem("veyro-theme", a.theme); localStorage.setItem("veyro-theme-pref", a.theme); localStorage.setItem("veyro-lang", a.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.selectOption("#gv-scn", "select");
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await wait(2500);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, SEED.email);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/account/billing`, { waitUntil: "networkidle" });
      await page.waitForSelector(".gv-plan", { timeout: 60000 }).catch(() => {});
      await wait(2500);
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
      report[key] = { checked: [A.__checked, B.__checked], goDisabled: [A.__goDisabled, B.__goDisabled], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 40) };
    }
  }
  return report;
}
