// Parity Gate for the landing page's features grid (MagicBento), step 4.17b.
// Reference: screens/groups/01-public-marketing/index.html (#magic-bento). Next: /{lang}. Nothing needs a backend or a sign-in.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/bento.js
// The static server must be on :4173 and the frontend on :3000. Motion is switched off (reduced-motion), so the grid shows at once and the numbers are stable;
// the motion itself (intro, spotlight, ripple, replaying artwork) is checked by hand in a real browser.
// Every element inside each card's artwork is compared in document order (tag, class, box and computed style), as are the cards, their text and the grid.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/01-public-marketing/index.html";
  const NEXT = "http://localhost:3000";
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  // hover = move the pointer to the middle of that card; scrub = move over the progress chart of card 1
  const STATES = [{ name: "static" }, { name: "hover3", hover: 3 }, { name: "hover4", hover: 4 }, { name: "scrub", scrub: true }];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "backgroundImage", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingLeft", "letterSpacing", "lineHeight", "textAlign", "boxShadow", "display", "opacity", "transform", "fill", "stroke", "strokeWidth"];
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = () => page.evaluate((props) => {
    const root = document.querySelector("#magic-bento");
    const box = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); const o = { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; for (const p of props) o[p] = p === "fontFamily" ? cs[p].split(",")[0].replace(/["']/g, "").trim() : cs[p]; return o; };
    const out = { root: box(root), cells: [], vis: [], vars: [], texts: [] };
    out.attrs = [root.className, root.dataset.theme, "motion" in root.dataset];
    const cells = [...root.querySelectorAll(".magic-bento__cell")];
    out.cols = getComputedStyle(root).gridTemplateColumns;
    cells.forEach((cell, i) => {
      const card = cell.querySelector(".magic-bento__card");
      out.cells.push({ cell: box(cell), card: box(card), title: box(card.querySelector(".magic-bento__title")), desc: box(card.querySelector(".magic-bento__description")), visual: box(card.querySelector(".magic-bento__visual")), active: "active" in card.dataset, state: cell.dataset.state ?? null });
      out.vars.push(["--mb-near", "--mb-hot", "--mb-press"].map((v) => Number(card.style.getPropertyValue(v)).toFixed(2))); // eased over time, so two decimals
      out.vis.push([...card.querySelectorAll(".magic-bento__visual *")].map((el) => ({ tag: el.tagName, cls: (el.getAttribute("class") || "").replace(/\s+/g, " ").trim(), ...box(el) })));
      out.texts.push(card.textContent.replace(/\s+/g, " ").trim());
    });
    return out;
  }, PROPS);

  const act = async (st) => {
    if (st.hover) {
      const r = await page.locator(`#magic-bento .magic-bento__cell:nth-child(${st.hover})`).boundingBox();
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await wait(250); await page.mouse.move(r.x + r.width / 2 + 6, r.y + r.height / 2 + 4); await wait(900);
    }
    if (st.scrub) {
      const r = await page.locator("#magic-bento .magic-bento__plot").first().boundingBox();
      await page.mouse.move(r.x + r.width * 0.3, r.y + r.height / 2); await wait(200); await page.mouse.move(r.x + r.width * 0.62, r.y + r.height / 2); await wait(600);
    }
  };
  const open = async (url) => {
    await page.goto(url, { waitUntil: "load" });
    await wait(1500);
    await page.locator("#features").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector("#magic-bento").scrollIntoView({ block: "center" }));
    await wait(1800);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      if (c.w < 1000 && st.hover) continue; // no pointer on a phone
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => { localStorage.setItem("veyro-theme", a.theme); localStorage.setItem("veyro-lang", a.lang); }, c);
      await open(REF);
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) { await page.click(".js-lang-toggle"); await wait(800); }
      await act(st);
      const A = await measure();
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}`, { waitUntil: "networkidle" });
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); }, c);
      await open(`${NEXT}/${c.lang}`);
      await act(st);
      const B = await measure();

      const diffs = [];
      const cmp = (label, a, b) => {
        if (!a || !b) { diffs.push(`${label}: ${a ? "MISSING in Next" : "only in Next"}`); return; }
        for (const p of [...PROPS, "tag", "cls"]) {
          if (p === "borderTopColor" && a.borderTopWidth === "0px" && b.borderTopWidth === "0px") continue;
          if (a[p] !== undefined && a[p] !== b[p]) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
        }
        for (const p of ["x", "y", "w", "h"]) if (Math.abs(a[p] - b[p]) > 1) diffs.push(`${label}.${p}: ${a[p]} -> ${b[p]}`);
      };
      cmp("root", A.root, B.root);
      if (A.cols !== B.cols) diffs.push(`cols: ${A.cols} -> ${B.cols}`);
      if (JSON.stringify(A.attrs) !== JSON.stringify(B.attrs)) diffs.push(`attrs: ${JSON.stringify(A.attrs)} -> ${JSON.stringify(B.attrs)}`);
      A.cells.forEach((a, i) => {
        const b = B.cells[i]; if (!b) { diffs.push(`cell${i + 1}: MISSING in Next`); return; }
        for (const part of ["cell", "card", "title", "desc", "visual"]) cmp(`c${i + 1}-${part}`, a[part], b[part]);
        if (a.active !== b.active) diffs.push(`c${i + 1}.active: ${a.active} -> ${b.active}`);
        if (a.state !== b.state) diffs.push(`c${i + 1}.state: ${a.state} -> ${b.state}`);
        if (JSON.stringify(A.vars[i]) !== JSON.stringify(B.vars[i])) diffs.push(`c${i + 1}.vars: ${JSON.stringify(A.vars[i])} -> ${JSON.stringify(B.vars[i])}`);
        if (A.texts[i] !== B.texts[i]) diffs.push(`c${i + 1}.text: ${A.texts[i]} -> ${B.texts[i]}`);
        const va = A.vis[i], vb = B.vis[i];
        if (va.length !== vb.length) diffs.push(`c${i + 1}.visual count: ${va.length} -> ${vb.length}`);
        va.forEach((x, j) => cmp(`c${i + 1}v${j}`, x, vb[j]));
      });
      if (A.cells.length !== B.cells.length) diffs.push(`cards: ${A.cells.length} -> ${B.cells.length}`);
      report[key] = { cards: [A.cells.length, B.cells.length], n: diffs.length, diffs: diffs.slice(0, 50) };
    }
  }
  return report;
}
