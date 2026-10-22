// Parity Gate for the Project members dialog and the Deleted tasks view of the board (SCR-PRJ-01, CS-05).
// Reference: screens/groups/04-projects-tasks/board.html. Next: /{lang}/w/{slug}/projects/{KEY}.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/board-members.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// SEED holds the throwaway test users and workspace (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/04-projects-tasks/board.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe52.mohand.e5sg78@veyro-test.io", "sarah": "fe52.sarah.e5sg78@veyro-test.io", "maya": "fe52.maya.e5sg78@veyro-test.io", "leo": "fe52.leo.e5sg78@veyro-test.io", "eng": "fe52-eng-e5sg78"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah, padmin: SEED.maya, member: SEED.leo };
  const KEYS = { full: "AUT", readonly: "ROP" };
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("dlg", "dialog[open]"), SAME("in", ".st-dlg-in"), SAME("head", ".pm-head"), SAME("h2", ".pm-head h2"), SAME("sub", ".pm-head p"), SAME("x", ".pm-x"),
    SAME("list", ".pmb-list"), SAME("row1", ".pmb-row:nth-child(1)"), SAME("who1", ".pmb-row:nth-child(1) .pmb-who"), SAME("av1", ".pmb-row:nth-child(1) .pmb-av"), SAME("name1", ".pmb-row:nth-child(1) b"), SAME("tag1", ".pmb-row:nth-child(1) .pmb-tag"), SAME("tag1b", ".pmb-row:nth-child(1) .pmb-tag:nth-of-type(2)"), SAME("r1", ".pmb-row:nth-child(1) .pmb-r"), SAME("badge1", ".pmb-row:nth-child(1) .st-badge"), SAME("sel1", ".pmb-row:nth-child(1) .pmb-rsel"), SAME("sel1-in", ".pmb-row:nth-child(1) select"), SAME("x1", ".pmb-row:nth-child(1) .pmb-x"), SAME("rm1", ".pmb-row:nth-child(1) .st-icon"),
    SAME("row2", ".pmb-row:nth-child(2)"), SAME("badge2", ".pmb-row:nth-child(2) .st-badge"), SAME("sel2-in", ".pmb-row:nth-child(2) select"), SAME("rm2", ".pmb-row:nth-child(2) .st-icon"),
    SAME("row3", ".pmb-row:nth-child(3)"), SAME("row4", ".pmb-row:nth-child(4)"), SAME("badge4", ".pmb-row:nth-child(4) .st-badge"), SAME("sel4-in", ".pmb-row:nth-child(4) select"), SAME("row5", ".pmb-row:nth-child(5)"), SAME("rm5", ".pmb-row:nth-child(5) .st-icon"),
    SAME("add", ".pmb-add:not([hidden])"), SAME("pick", "#pmb-pick"), SAME("role", "#pmb-role"), SAME("addbtn", "#pmb-addbtn"), SAME("none", "#pmb-none:not([hidden])"),
    SAME("foot", ".pm-foot"), SAME("done", "#pmb-done"),
    SAME("trash-card", ".bd-trash"), SAME("trash-h", ".bd-trash .ap-ch"), SAME("trash-h2", ".bd-trash h2"), SAME("trash-n", ".bd-trash .st-count"), SAME("trash-note", ".bd-trash .st-note"),
    SAME("tl", ".bd-tl"), SAME("tli1", ".bd-tli:nth-child(1)"), SAME("tlt1", ".bd-tli:nth-child(1) .bd-tlt"), SAME("tlt1-b", ".bd-tli:nth-child(1) .bd-tlt b"), SAME("tlt1-s", ".bd-tli:nth-child(1) .bd-tlt small"), SAME("tlm1", ".bd-tli:nth-child(1) .bd-tlm"), SAME("tlm1-av", ".bd-tli:nth-child(1) .bd-av"), SAME("tlm1-s", ".bd-tli:nth-child(1) .bd-tlm small"), SAME("tla1", ".bd-tli:nth-child(1) .bd-tla"), SAME("tla1-open", ".bd-tli:nth-child(1) .bd-tla .pm-ghost"), SAME("tla1-go", ".bd-tli:nth-child(1) .bd-tla .pm-go"), SAME("tla1-svg", ".bd-tli:nth-child(1) .bd-tla svg"),
    SAME("tli2", ".bd-tli:nth-child(2)"), SAME("tli3", ".bd-tli:nth-child(3)"), SAME("tl-empty", ".bd-tl-empty"),
    SAME("trash-btn", "#bd-trash"), SAME("trash-btn-t", "#bd-trash-t"), SAME("tools-hidden", ".bd-tools"), SAME("board-hidden", ".bd-board"), SAME("tabs-hidden", ".bd-tabs"),
  ];
  const STATES = [
    { name: "members", role: "admin", scn: "full", open: "#bd-mbtn", dialog: true },
    { name: "members-owner", role: "owner", scn: "full", open: "#bd-mbtn", dialog: true },
    { name: "members-padmin", role: "padmin", scn: "full", open: "#bd-mbtn", dialog: true },
    { name: "members-member", role: "member", scn: "full", open: "#bd-mbtn", dialog: true },
    { name: "members-readonly", role: "admin", scn: "readonly", open: "#bd-mbtn", dialog: true },
    { name: "trash", role: "admin", scn: "full", open: "#bd-trash" },
    { name: "trash-readonly", role: "admin", scn: "readonly", open: "#bd-trash" },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props, dialog }) => {
    const root = dialog ? [...document.querySelectorAll("dialog[open]")].pop() : document.querySelector(".ap-body");
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
      if (t && !/prototype/i.test(t)) texts.push(t);
    }
    out.__texts = texts;
    out.__vals = [...root.querySelectorAll("select")].map((e) => e.value).join("|");
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
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role: st.role, c });
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      if (st.scn !== "full") await page.selectOption("#bd-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      await page.click(st.open); await wait(1500);
      if (st.dialog) await page.waitForSelector("dialog[open]", { timeout: 8000 });
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS, dialog: !!st.dialog });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}/projects/${KEYS[st.scn]}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".bd-card, .bd-empty-card", { timeout: 30000 });
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2000);
      await page.click(st.open); await wait(2500);
      if (st.dialog) await page.waitForSelector("dialog[open]", { timeout: 8000 });
      const B = await measure({ list: LIST.map((l) => [l[0], l[2]]), props: PROPS, dialog: !!st.dialog });

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
      report[key] = { vals: [A.__vals, B.__vals], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
