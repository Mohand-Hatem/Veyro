// Parity Gate for the in-app Contact page (SCR-HLP-02), content area only.
// Reference: screens/groups/03-workspace-dashboard/contact.html (shared renderer screens/shared/contact.js). Next: /{lang}/help/contact.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/contact.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed is the reference's own people (mohand/sarah/leo @acme.io; backend/tmp-seed63.ts). The success and rate-limit states answer POST /contact
// from the harness (201 / 429) so repeated runs never reach the real hourly limit; the real send is checked separately.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/contact.html";
  const NEXT = "http://localhost:3000";
  const PERSONA = { owner: "mohand@acme.io", admin: "sarah@acme.io", member: "leo@acme.io" };
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const LIST = [
    SAME("page", ".ct-page"), SAME("grid", ".ct-grid"), SAME("hero", ".ct-hero"), SAME("hero-t", ".ct-hero-t"), SAME("h1", ".ct-hero h1"), SAME("hero-p", ".ct-hero-t > p:nth-of-type(1)"), SAME("hint", ".ct-hint"), SAME("hint-a", ".ct-hint a"),
    SAME("ill", ".ct-ill"), SAME("ill-svg", ".ct-ill svg"), SAME("chip", "#ct-chip"),
    SAME("card", ".ct-card"), SAME("form-h", "#ct-fh"), SAME("alert", "#ct-alert:not([hidden])"), SAME("two", ".ct-two"),
    SAME("f-name", ".ct-two .ct-f:nth-child(1)"), SAME("l-name", "label[for=ct-name]"), SAME("in-name", "#ct-name"), SAME("err-name", "#ct-name-e:not([hidden])"),
    SAME("f-email", ".ct-two .ct-f:nth-child(2)"), SAME("l-email", "label[for=ct-email]"), SAME("in-email", "#ct-email"), SAME("err-email", "#ct-email-e:not([hidden])"),
    SAME("topics", ".ct-topics"), SAME("legend", ".ct-topics legend"), SAME("topic1", ".ct-topic:nth-child(1) span"), SAME("topic1-b", ".ct-topic:nth-child(1) b"), SAME("topic1-s", ".ct-topic:nth-child(1) small"), SAME("topic2", ".ct-topic:nth-child(2) span"), SAME("topic5", ".ct-topic:nth-child(5) span"), SAME("topic-on", ".ct-topic input:checked + span"),
    SAME("l-msg", "label[for=ct-msg]"), SAME("in-msg", "#ct-msg"), SAME("count", "#ct-count"), SAME("err-msg", "#ct-msg-e:not([hidden])"),
    SAME("send", "#ct-send"), SAME("note", ".ct-note"),
    SAME("done", ".ct-done"), SAME("ok", ".ct-ok"), SAME("done-h", ".ct-done h2"), SAME("done-p", ".ct-done p"), SAME("act", ".ct-act"), SAME("again", "#ct-again"), SAME("back", ".ct-act a"),
  ];
  const MSG = "Parity check: nothing here is real, please ignore.";
  // topic = value of the topic radio to pick, name/email/message = what to type, submit = press Send, mock = what the real server is made to answer
  const STATES = [
    { name: "empty", role: "owner" },
    { name: "admin", role: "admin" },
    { name: "member", role: "member" },
    { name: "topic-problem", role: "owner", topic: "PROBLEM" },
    { name: "topic-other", role: "member", topic: "OTHER" },
    { name: "typed", role: "owner", topic: "BILLING", message: MSG },
    { name: "errors", role: "owner", name1: "", email: "not-an-email", message: "short", submit: true },
    { name: "sent", role: "owner", topic: "FEEDBACK", message: MSG, submit: true, mock: 201 },
    { name: "rate-limited", role: "member", message: MSG, submit: true, mock: 429 },
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
    out.__checked = (document.querySelector(".ct-topic input:checked") || {}).value || null;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st) => {
    if (st.topic) { // on a phone the fixed bottom bar can cover the radio at the screen edge, so bring the choice to the middle first
      const lab = page.locator(`.ct-topic:has(input[value=${st.topic}])`);
      await lab.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await lab.click();
    }
    if (st.name1 !== undefined) await page.fill("#ct-name", st.name1);
    if (st.email !== undefined) await page.fill("#ct-email", st.email);
    if (st.message !== undefined) await page.fill("#ct-msg", st.message);
    if (st.submit) { await page.click("#ct-send"); await wait(2200); }
    await wait(300);
  };

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${st.role} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => {
        sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role);
        // the reference limits by email in this browser session: three recent sends make the fourth refused
        if (a.rate) sessionStorage.setItem("veyro-contact-proto", JSON.stringify([1, 2, 3].map(() => ({ e: a.email, t: Date.now() }))));
        localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0");
      }, { role: st.role, c, rate: st.mock === 429, email: PERSONA[st.role] });
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
      await wait(2500);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, PERSONA[st.role]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((c) => { localStorage.setItem("theme", c.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      const SEND = /\/api\/v1\/contact$/;
      await page.unroute(SEND).catch(() => {});
      if (st.mock === 201) await page.route(SEND, (r) => r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, data: { received: true } }) }));
      if (st.mock === 429) await page.route(SEND, (r) => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "CONTACT_RATE_LIMITED", message: "Too many messages in a short time. Please try again in an hour." } }) }));
      await page.goto(`${NEXT}/${c.lang}/help/contact`, { waitUntil: "networkidle" });
      await page.waitForSelector(".ct-page", { timeout: 60000 }).catch(() => {});
      await page.addStyleTag({ content: "html{overflow-y:scroll}" });
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
      report[key] = { checked: [A.__checked, B.__checked], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 50) };
    }
  }
  return report;
}
