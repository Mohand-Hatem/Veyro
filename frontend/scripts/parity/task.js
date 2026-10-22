// Parity Gate for the task page (SCR-TSK-01), content area only (the shell has its own run: shell.js).
// Reference: screens/groups/04-projects-tasks/task.html?id=tsk_N. Next: /{lang}/w/{slug}/projects/{KEY}/tasks/{id}.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/task.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// SEED holds the throwaway test users and workspace (stale after cleanup; re-seed to reuse). Numbers are masked in the text diff because the data differs.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/04-projects-tasks/task.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "fe53.mohand.iykkdy@veyro-test.io", "sarah": "fe53.sarah.iykkdy@veyro-test.io", "maya": "fe53.maya.iykkdy@veyro-test.io", "leo": "fe53.leo.iykkdy@veyro-test.io", "eng": "fe53-eng-iykkdy"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const PERSONA = { owner: SEED.mohand, admin: SEED.sarah, padmin: SEED.maya, member: SEED.leo };
  const KEYS = { full: "AUT", readonly: "ROP", archived: "ARC" };
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("ovh", ".ap-ovh"), SAME("crumbs", ".bd-crumbs"), SAME("crumb-a", ".bd-crumbs a"), SAME("crumb-p", "#tp-crumb-p"), SAME("crumb-b", "#tp-crumb"),
    SAME("grid", ".tp-grid"), SAME("main", ".tp-main"), SAME("head", ".tp-head"), SAME("top", ".tp-top"), SAME("back", ".tp-back"), SAME("back-svg", ".tp-back svg"), SAME("saved", "#tp-saved"), SAME("reopen", "#tp-reopen"), SAME("del", "#tp-del"), SAME("tags", ".tp-tags"), SAME("key", "#tp-key"), SAME("pill", "#tp-pill"), SAME("title", "#tp-title"),
    SAME("deleted", "#tp-deleted"), SAME("ring", "#tp-ring"), SAME("days", "#tp-days"), SAME("del-t", "#tp-del-t"), SAME("del-d", "#tp-del-d"), SAME("restore", "#tp-restore"),
    SAME("fields", ".tp-fields"), SAME("note", "#tp-note"), SAME("dgrid", ".td-grid"), SAME("f1", ".td-grid .pm-f:nth-child(1)"), SAME("l1", ".td-grid .pm-f:nth-child(1) label"), SAME("status", "#tp-status"), SAME("prio", "#tp-prio"), SAME("cat", "#tp-cat"), SAME("assignee", "#tp-assignee"), SAME("due", "#tp-due"), SAME("lrow", ".tp-fields .pm-lrow"), SAME("dcount", "#tp-dcount"), SAME("desc", "#tp-desc"),
    SAME("meta", "#tp-meta"), SAME("meta1", "#tp-meta > div:nth-child(1)"), SAME("meta1-dt", "#tp-meta > div:nth-child(1) dt"), SAME("meta1-dd", "#tp-meta > div:nth-child(1) dd"), SAME("meta3", "#tp-meta > div:nth-child(3)"),
    SAME("comments", ".td-comments"), SAME("ch", "#tp-ch"), SAME("cn", "#tp-cn"), SAME("cl", "#tp-cl"), SAME("c1", ".td-c:nth-child(1)"), SAME("c1-av", ".td-c:nth-child(1) .bd-av"), SAME("c1-b", ".td-c:nth-child(1) b"), SAME("c1-s", ".td-c:nth-child(1) small"), SAME("c1-p", ".td-c:nth-child(1) p"), SAME("c2", ".td-c:nth-child(2)"), SAME("c3", ".td-c:nth-child(3)"), SAME("sys", ".td-c.is-sys"), SAME("none", ".td-c-none"),
    SAME("cform", "#tp-cform"), SAME("cin", "#tp-cin"), SAME("csend", "#tp-csend"),
    SAME("side", ".tp-side"), SAME("illu", ".tp-side .il-illu"), SAME("svg", ".tp-side svg"), SAME("prog", "#tp-prog"), SAME("stop1", ".tp-stop:nth-child(1) circle"), SAME("stop1-t", ".tp-stop:nth-child(1) text"), SAME("stop2", ".tp-stop:nth-child(2) circle"), SAME("stop3", ".tp-stop:nth-child(3) circle"), SAME("stop4", ".tp-stop:nth-child(4) circle"), SAME("cx", "#tp-cx rect"), SAME("cxl", "#tp-cxl"), SAME("card", "#tp-cardr"), SAME("ct", "#tp-ct"), SAME("cpr", "#tp-cpr"), SAME("cp", "#tp-cp"), SAME("ca", "#tp-ca"),
    SAME("caps", ".tp-side .il-caps"), SAME("cap-on", ".tp-side .il-cap.is-on"), SAME("pager", ".tp-side .il-pager"), SAME("dot-on", ".tp-side .il-pager button.is-on"),
    SAME("empty", ".st-denied"), SAME("empty-ill", ".st-denied .ap-empty-ill"), SAME("empty-h2", ".st-denied h2"), SAME("empty-p", ".st-denied p"), SAME("empty-btn", ".st-denied .st-back"),
    SAME("err", ".st-error"), SAME("err-b", ".st-error b"), SAME("err-p", ".st-error p"), SAME("err-btn", ".st-error .pm-btn"),
  ];
  // title = the task's title in the seed; refId = the id used by the reference page
  const STATES = [
    { name: "todo", role: "admin", scn: "full", title: "Rate-limit login endpoint", ref: "tsk_1" },
    { name: "progress", role: "admin", scn: "full", title: "OAuth sign-in gateway", ref: "tsk_6" },
    { name: "review", role: "admin", scn: "full", title: "Replace password strength meter", ref: "tsk_10" },
    { name: "done", role: "admin", scn: "full", title: "Login page redesign", ref: "tsk_13" },
    { name: "cancelled", role: "admin", scn: "full", title: "SMS fallback for OTP", ref: "tsk_18" },
    { name: "deleted", role: "admin", scn: "full", title: "Old signup A/B test", ref: "tsk_19", deleted: true },
    { name: "owner", role: "owner", scn: "full", title: "OAuth sign-in gateway", ref: "tsk_6" },
    { name: "padmin", role: "padmin", scn: "full", title: "OAuth sign-in gateway", ref: "tsk_6" },
    { name: "member-own", role: "member", scn: "full", title: "OAuth sign-in gateway", ref: "tsk_6" },
    { name: "member-other", role: "member", scn: "full", title: "Refresh token rotation", ref: "tsk_7" },
    { name: "readonly", role: "admin", scn: "readonly", title: "OAuth sign-in gateway", ref: "tsk_6" },
    { name: "archived", role: "admin", scn: "archived", title: "Login page redesign", ref: "tsk_13" },
    { name: "notfound", role: "admin", scn: "full", title: null, ref: "tsk_999", bogus: true },
    { name: "error", role: "admin", scn: "error", title: "OAuth sign-in gateway", ref: "tsk_6" },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity", "transform"];
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
    out.__vals = [...root.querySelectorAll("select,input,textarea")].map((e) => e.value).join("|");
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${st.role} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(`${REF}?id=${st.ref}`, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role: st.role, c });
      await page.reload({ waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      if (st.scn !== "full") await page.selectOption("#tp-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(3000);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const pk = KEYS[st.scn] ?? "AUT";
      // the Next page needs the real id: find it by title through the API (the harness's own login is the viewer)
      const id = st.bogus ? "tsk_does_not_exist" : await page.evaluate(async ({ slug, pk, title, deleted }) => {
        const ws = (await (await fetch("/api/v1/workspaces")).json()).data.find((x) => x.slug === slug);
        const p = (await (await fetch(`/api/v1/workspaces/${ws.id}/projects`)).json()).data.find((x) => x.key === pk);
        const rows = (await (await fetch(`/api/v1/projects/${p.id}/tasks?limit=100${deleted ? "&deleted=true" : ""}`)).json()).data.tasks;
        return rows.find((x) => x.title === title)?.id;
      }, { slug: SEED.eng, pk, title: st.title, deleted: !!st.deleted });
      if (st.scn === "error") await page.route(/\/api\/v1\/tasks\/[^/?]+$/, (r) => r.abort());
      else await page.unroute(/\/api\/v1\/tasks\/[^/?]+$/).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/w/${SEED.eng}/projects/${pk}/tasks/${id}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".tp-grid, .st-denied, .st-error", { timeout: 45000 }).catch(() => {});
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
      report[key] = { vals: [A.__vals, B.__vals], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 30) };
    }
  }
  return report;
}
