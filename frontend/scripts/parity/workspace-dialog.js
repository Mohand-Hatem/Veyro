// Parity Gate for the Create workspace dialog (SCR-WKSP-02).
// Reference: screens/groups/03-workspace-dashboard/index.html (role Account Owner; opens from the switcher's "+ New workspace"). Next: the same button in the shell of /{lang}/w/acme-eng.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/workspace-dialog.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed (backend/tmp-seed65.ts) mirrors the reference people and workspaces: Acme Global on Pro with two workspaces, one address already taken. SEED is stale after cleanup.
// The "full" state answers the subscription request from the harness (Free, 1 allowed, 2 used: the reference's downgraded scenario); the real cap is checked by backend/test/cs14 and a real run.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/index.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "mohand.ws65.mvi4ik2w@veyro-test.io"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const NAME = ".pm-f:nth-child(3)", SLUG = ".pm-f:nth-child(4)", CARD = (n) => `svg > g:nth-of-type(${n})`;
  const LIST = [
    SAME("dlg", "dialog.wm[open]"), SAME("form", ".pm-form"), SAME("main", ".pm-main"), SAME("head", ".pm-head"), SAME("h2", ".pm-head h2"), SAME("sub", ".pm-head p"), SAME("x", ".pm-x"),
    SAME("alert", ".pm-alert:not([hidden])"), SAME("alert-a", ".pm-alert a"),
    SAME("f-name", NAME), SAME("l-name", `${NAME} label`), SAME("in-name", `${NAME} input`), SAME("err-name", `${NAME} .pm-err:not([hidden])`),
    SAME("f-slug", SLUG), SAME("lrow", `${SLUG} .pm-lrow`), SAME("l-slug", `${SLUG} label`), SAME("auto", `${SLUG} .pm-auto`), SAME("addr", ".wm-addr"), SAME("pre", ".wm-pre"), SAME("in-slug", ".wm-addr input"), SAME("reset", ".wm-addr .pm-link:not([hidden])"), SAME("hint", `${SLUG} .pm-hint`), SAME("err-slug", `${SLUG} .pm-err:not([hidden])`),
    SAME("note", ".pm-note"), SAME("foot", ".pm-foot"), SAME("cancel", ".pm-foot .pm-ghost"), SAME("go", ".pm-foot button[type=submit]"),
    SAME("side", ".pm-side"), SAME("illu", ".pm-side .il-illu"), SAME("svg", ".pm-side svg"),
    SAME("bld", "svg > rect.il-paper"), SAME("bld-head", "svg > path.il-brandfill"), SAME("acct", "svg > text.il-tw"), SAME("room-soft", "svg rect.il-soft"), SAME("room-lit", "svg rect.il-brandfill"), SAME("room-lit-t", "svg > g:nth-of-type(2) text.il-tw"), SAME("room-slot", "svg rect.il-slot"), SAME("room-soft-t", "svg > g:nth-of-type(2) text.il-t3"), SAME("slugtxt", "svg > text.il-t2"),
    SAME("wave", "svg .il-wave"), SAME("head-c", "svg .il-head"), SAME("body-c", "svg .il-body"),
    SAME("c1", CARD(4)), SAME("c1-t", `${CARD(4)} text.il-t3`), SAME("c1-av", `${CARD(4)} circle`),
    SAME("c2", CARD(5)), SAME("c2-l", `${CARD(5)} text:nth-of-type(1)`), SAME("c2-n", `${CARD(5)} text:nth-of-type(2)`), SAME("seg1", `${CARD(5)} g rect:nth-of-type(1)`), SAME("seg2", `${CARD(5)} g rect:nth-of-type(2)`), SAME("seg3", `${CARD(5)} g rect:nth-of-type(3)`),
    SAME("c3", CARD(6)), SAME("c3-t", `${CARD(6)} text`),
    SAME("caps", ".pm-side .il-caps"), SAME("cap-on", ".pm-side .il-cap.is-on"), SAME("pager", ".pm-side .il-pager"), SAME("dot-on", ".pm-side .il-pager button.is-on"),
  ];
  const LONG = "A very long workspace name for the clip test";
  // name / slug = what to type, submit = press Create, cap = pager dot to click, full = answer the plan as full
  const STATES = [
    { name: "empty" },
    { name: "typed", n: "Brand Studio" },
    { name: "slug-edited", n: "Brand Studio", s: "my-team" },
    { name: "long", n: LONG },
    { name: "arabic-only", n: "التسويق" },
    { name: "cap3", n: "Brand Studio", cap: 3 },
    { name: "errors", n: "A", s: "ab", submit: true },
    { name: "taken", n: "Brand Studio", s: "acme-eng", submit: true },
    { name: "full", n: "Another", full: true, cap: 3 },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity", "fill", "stroke"];
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
    out.__values = [...root.querySelectorAll("input")].map((i) => i.value).join("|");
    out.__goDisabled = root.querySelector(".pm-foot button[type=submit]")?.disabled ?? null;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st, wait2) => {
    await page.click("#ap-ws");
    await page.click(".ap-wsm-new");
    await page.waitForSelector("dialog.wm[open]", { timeout: 15000 });
    await wait(1200); // the dialog opens with a short animation and the plan numbers load
    if (st.n !== undefined) await page.fill(`dialog.wm[open] ${NAME} input`, st.n);
    if (st.s !== undefined) await page.fill("dialog.wm[open] .wm-addr input", st.s);
    if (st.submit) { await page.click("dialog.wm[open] .pm-foot button[type=submit]"); await wait(wait2); }
    if (st.cap && page.viewportSize().width >= 860) await page.click(`dialog.wm[open] .il-pager button:nth-child(${st.cap})`);
    await wait(st.cap ? 1200 : 500); // a caption fades in over about a second
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
      if (st.full) await page.selectOption("#ap-scn", "downgraded");
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await wait(2500);
      if (c.w < 860) { await page.click("#ap-burger").catch(() => {}); }
      await act(st, 1300);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.unroute(/\/api\/v1\/accounts\/[^/]+\/subscription$/).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, SEED.mohand);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      if (st.full) await page.route(/\/api\/v1\/accounts\/[^/]+\/subscription$/, async (r) => { const res = await r.fetch(); const j = await res.json(); j.data.subscription.tier = "FREE"; j.data.limits = { ...j.data.limits, tier: "FREE", maxProjects: 3, maxWorkspaces: 1, currentWorkspaces: 2 }; await r.fulfill({ response: res, json: j }); });
      await page.goto(`${NEXT}/${c.lang}/w/acme-eng`, { waitUntil: "networkidle" });
      await page.waitForSelector(".ap-wsm-new, #ap-ws", { timeout: 60000, state: "attached" }).catch(() => {});
      await wait(2500);
      if (c.w < 860) { await page.click("#ap-burger").catch(() => {}); }
      await act(st, 3000);
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
      report[key] = { values: [A.__values, B.__values], goDisabled: [A.__goDisabled, B.__goDisabled], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 40) };
    }
  }
  return report;
}
