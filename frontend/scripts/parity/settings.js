// Parity Gate for Members & settings (SCR-SET-01): page, confirm dialogs and the one-time link dialog.
// Reference: screens/groups/03-workspace-dashboard/settings.html. Next: /{lang}/w/{slug}/settings.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/settings.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed must use the reference's own people and emails (mohand@acme.io, ...): it refuses to run if they exist. SEED.slug is stale after cleanup.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/settings.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"slug": "acme-eng-cskb8y"};
  const PERSONA = { owner: "mohand@acme.io", admin: "sarah@acme.io", member: "leo@acme.io" };
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("sub", ".ap-ovh h2"),
    SAME("top", ".st-top"), SAME("details", ".st-details"), SAME("d-h", ".st-details .ap-ch"), SAME("d-h2", ".st-details h2"), SAME("counts", "#st-counts"),
    SAME("f-name", "#st-f-name"), SAME("l-name", "#st-f-name label"), SAME("in-name", "#st-name"), SAME("f-slug", "#st-f-slug"), SAME("slugrow", ".st-slugrow"), SAME("slugpre", ".st-slugpre"), SAME("in-slug", "#st-slug"), SAME("hint", "#st-slug-h"),
    SAME("foot", ".st-foot"), SAME("reset", "#st-reset"), SAME("save", "#st-save"), SAME("meta", "#st-meta"), SAME("meta1", "#st-meta > div:nth-child(1)"), SAME("meta1-dt", "#st-meta dt"), SAME("meta1-dd", "#st-meta dd"), SAME("meta2-dd", "#st-meta > div:nth-child(2) dd"),
    SAME("roles", ".st-roles"), SAME("illu", ".st-roles .il-illu"), SAME("svg", ".st-roles svg"), SAME("rc1", ".st-roles .rc:nth-child(2) rect"), SAME("rc-t", ".st-roles .rc:nth-child(2) .il-t3"), SAME("caps", ".st-roles .il-caps"), SAME("cap-on", ".st-roles .il-cap.is-on"), SAME("pager", ".st-roles .il-pager"), SAME("dot-on", ".st-roles .il-pager button.is-on"),
    SAME("members", ".st-members"), SAME("mh", ".st-mh"), SAME("mh2", ".st-mh h2"), SAME("mcount", "#st-m-count"), SAME("tools", ".st-tools"), SAME("search", ".st-search"), SAME("search-in", "#st-q"), SAME("filter", "#st-filter"), SAME("invite", "#st-invite"),
    SAME("th", ".st-th"), SAME("th1", ".st-th span:nth-child(1)"), SAME("th4", ".st-th span:nth-child(4)"),
    SAME("row1", ".st-row:nth-child(1)"), SAME("av1", ".st-row:nth-child(1) .st-av"), SAME("wt1", ".st-row:nth-child(1) .st-wt"), SAME("name1", ".st-row:nth-child(1) .st-wt b"), SAME("mail1", ".st-row:nth-child(1) .st-wt small"), SAME("rc1b", ".st-row:nth-child(1) .st-badge"), SAME("jd1", ".st-row:nth-child(1) .st-jd"), SAME("ac1", ".st-row:nth-child(1) .st-ac"),
    SAME("row2", ".st-row:nth-child(2)"), SAME("you", ".st-you"), SAME("badge2", ".st-row:nth-child(2) .st-badge"),
    SAME("row3", ".st-row:nth-child(3)"), SAME("rsel3", ".st-row:nth-child(3) .st-rsel"), SAME("rsel3-in", ".st-row:nth-child(3) select"), SAME("rm3", ".st-row:nth-child(3) .st-icon"), SAME("rm3-svg", ".st-row:nth-child(3) .st-icon svg"),
    SAME("row7", ".st-row:nth-child(7)"), SAME("none", "#st-none"),
    SAME("invites", ".st-invites"), SAME("ih", ".st-invites .ap-ch"), SAME("ih2", ".st-invites h2"), SAME("icount", "#st-i-count"), SAME("note", ".st-note"),
    SAME("inv1", ".st-inv:nth-child(1)"), SAME("iw1", ".st-inv:nth-child(1) .st-iw"), SAME("iw1-b", ".st-inv:nth-child(1) .st-iw b"), SAME("iw1-s", ".st-inv:nth-child(1) .st-iw small"), SAME("ir1", ".st-inv:nth-child(1) .st-ir"), SAME("ir1-b", ".st-inv:nth-child(1) .st-badge"), SAME("ir1-k", ".st-inv:nth-child(1) .ap-key"), SAME("ie1", ".st-inv:nth-child(1) .st-ie"), SAME("ie1-s", ".st-inv:nth-child(1) .st-ie small"), SAME("ia1", ".st-inv:nth-child(1) .st-ia"), SAME("resend1", ".st-inv:nth-child(1) .pm-ghost"), SAME("revoke1", ".st-inv:nth-child(1) .st-link-danger"),
    SAME("inv2", ".st-inv:nth-child(2)"), SAME("inv3", ".st-inv:nth-child(3)"), SAME("exp", ".b-exp"), SAME("exp-s", ".st-inv:nth-child(3) .st-ie small"), SAME("inv-empty", ".st-inv-empty"),
    SAME("denied", ".st-denied"), SAME("denied-ill", ".st-denied .ap-empty-ill"), SAME("denied-h2", ".st-denied h2"), SAME("denied-p", ".st-denied p"), SAME("denied-btn", ".st-denied .st-back"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
    SAME("dlg", "dialog[open]"), SAME("dlg-in", "dialog[open] .st-dlg-in"), SAME("dlg-h2", "dialog[open] h2"), SAME("dlg-p", "dialog[open] p"), SAME("dlg-foot", "dialog[open] .pm-foot"), SAME("dlg-no", "dialog[open] .pm-ghost"), SAME("dlg-yes", "dialog[open] .st-danger"),
    SAME("lbox", "dialog[open] .st-linkbox"), SAME("lurl", "dialog[open] .st-linkbox input"), SAME("lcopy", "dialog[open] .st-linkbox .pm-go"), SAME("lhint", "dialog[open] .pm-hint"),
  ];
  const STATES = [
    { name: "admin", role: "admin" },
    { name: "owner", role: "owner" },
    { name: "denied", role: "member" },
    { name: "error", role: "admin", scn: "error" },
    { name: "filter", role: "admin", select: ["#st-filter", "ADMIN"] },
    { name: "search", role: "admin", fill: ["#st-q", "mohand"] },
    { name: "nomatch", role: "admin", fill: ["#st-q", "zzzz"] },
    { name: "confirm-remove", role: "admin", click: ".st-row:nth-child(3) .st-icon", dialog: true },
    { name: "confirm-revoke", role: "admin", click: ".st-inv:nth-child(1) .st-link-danger", dialog: true },
    { name: "link", role: "admin", click: ".st-inv:nth-child(1) .pm-ghost", dialog: true, slow: true },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity", "transform"];
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
    out.__rows = document.querySelectorAll(".st-row").length;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st) => {
    if (st.click) { await page.click(st.click, { timeout: 5000 }); await wait(st.slow ? 2500 : 900); }
    if (st.select) { await page.selectOption(st.select[0], st.select[1]); await wait(700); }
    if (st.fill) { await page.fill(st.fill[0], st.fill[1]); await wait(700); }
    if (st.dialog) await page.waitForSelector("dialog[open]", { timeout: 8000 });
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
      if (st.scn) await page.selectOption("#st-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS, dialog: !!st.dialog });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const ERR = /\/api\/v1\/workspaces\/[^/]+\/(members|invitations)/;
      if (st.scn === "error") await page.route(ERR, (r) => r.abort());
      else await page.unroute(ERR).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.slug}/settings`, { waitUntil: "networkidle" });
      await page.waitForSelector(".st-row:not(.st-skel), .st-denied, .st-error", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      await act(st);
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
      report[key] = { rows: [A.__rows, B.__rows], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
