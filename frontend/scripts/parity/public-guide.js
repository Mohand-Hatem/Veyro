// Parity Gate for the public How it works page (SCR-HLP-01 in the public frame), content area only (the frame is the landing page's navigation and footer).
// Reference: screens/groups/01-public-marketing/how-it-works.html. Next: /{lang}/how-it-works. Nothing needs a backend or a sign-in.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/public-guide.js
// The static server must be on :4173 and the frontend on :3000. Motion is switched off (reduced-motion) so geometry is stable.
// The public guide opens on the Account Owner role; the other three are reached by clicking the picker, as in the reference.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/01-public-marketing/how-it-works.html";
  const NEXT = "http://localhost:3000";
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("main", "main"), SAME("wrap", "main .mk-wrap"),
    SAME("page", ".gd-page"), SAME("hero", ".gd-hero"), SAME("h1", ".gd-hero h1"), SAME("hero-p", ".gd-hero > p"), SAME("pick", ".gd-pick"), SAME("pick-l", ".gd-pick > span"), SAME("seg", ".gd-seg"), SAME("seg1", ".gd-seg button:nth-child(1)"), SAME("seg-on", ".gd-seg [aria-checked=true]"),
    SAME("toc", ".gd-toc"), SAME("toc1", ".gd-toc a:nth-child(1)"), SAME("toc1-i", ".gd-toc a:nth-child(1) i"), SAME("toc9", ".gd-toc a:nth-child(9)"),
  ];
  const SUB = [
    ["sec", ""], ["txt", " .gd-txt"], ["n", " .gd-n"], ["h2", " h2"], ["lead", " .gd-lead"], ["bl", " .gd-bl"], ["bl1", " .gd-bl li:nth-child(1)"], ["bl1-i", " .gd-bl li:nth-child(1) i"], ["bl1-s", " .gd-bl li:nth-child(1) span"], ["bl4", " .gd-bl li:nth-child(4)"],
    ["role", " .gd-role"], ["role-b", " .gd-role b"], ["role-s", " .gd-role span"],
    ["steps", " .gd-steps"], ["step1", " .gd-steps li:nth-child(1)"], ["step1-b", " .gd-steps li:nth-child(1) b"], ["step5", " .gd-steps li:nth-child(5)"],
    ["cc", " .gd-cc"], ["cc-h", " .gd-cc h3"], ["yes1", " .gd-cc .is-yes:nth-child(1)"], ["yes-i", " .gd-cc .is-yes i"], ["no1", " .gd-cc .is-no:nth-child(1)"], ["no-i", " .gd-cc .is-no i"],
    ["cta", " .gd-cta"], ["btn-go", " .gd-btn-go"], ["btn2", " .gd-btn:not(.gd-btn-go)"],
    ["ill", " .gd-ill"], ["svg", " .gd-ill svg"], ["svg-t1", " .gd-ill svg text:nth-of-type(1)"], ["svg-t3", " .gd-ill svg text:nth-of-type(3)"],
  ];
  for (let k = 1; k <= 9; k++) for (const [label, tail] of SUB) LIST.push(SAME(`s${k}-${label}`, `.gd-page > section:nth-of-type(${k})${tail}`));
  const STATES = [
    { name: "owner", role: "owner" },
    { name: "admin", role: "admin" },
    { name: "padmin", role: "padmin" },
    { name: "member", role: "member" },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props }) => {
    const root = document.querySelector("main");
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
    out.__sections = root.querySelectorAll(".gd-sec").length;
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
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); }, { c });
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      if (st.role !== "owner") { await page.click(`.gd-seg [data-role="${st.role}"]`); await wait(400); }
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/how-it-works`, { waitUntil: "networkidle" });
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); }, c);
      await page.goto(`${NEXT}/${c.lang}/how-it-works`, { waitUntil: "networkidle" });
      await page.waitForSelector(".gd-page", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      if (st.role !== "owner") { await page.click(`.gd-seg [data-role="${st.role}"]`); await wait(400); }
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
      report[key] = { sections: [A.__sections, B.__sections], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 60) };
    }
  }
  return report;
}
