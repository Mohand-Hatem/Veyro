// Parity Gate for the AI assistant page (SCR-AI-03, Mode A) and STATE-AI-QUOTA-MAX, content area only.
// Reference: screens/groups/05-ai-assistant/assistant.html (scenarios full, empty, quota, error via #as-scn; role through sessionStorage). Next: /{lang}/assistant.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/assistant.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed (backend/tmp-seed66.ts) mirrors the reference people: mohand has no AI data (empty), sarah has the "Getting started" conversation with 2 of 3 messages used (full),
// leo has the same conversation with 3 of 3 (quota). SEED is stale after cleanup.
// The "typing" and "error" states answer the send request from the harness (a long stall, a 502) so no real message is spent; the real send is checked separately.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/05-ai-assistant/assistant.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"mohand": "mohand.as66.mvi6bpz3@veyro-test.io", "sarah": "sarah.as66.mvi6bpz3@veyro-test.io", "leo": "leo.as66.mvi6bpz3@veyro-test.io"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const M = (n) => `.ai-m:nth-child(${n})`;
  const msg = (n) => [SAME(`m${n}`, M(n)), SAME(`m${n}-av`, `${M(n)} .ai-av`), SAME(`m${n}-bt`, `${M(n)} .ai-bt`), SAME(`m${n}-who`, `${M(n)} .ai-bt b`), SAME(`m${n}-time`, `${M(n)} small`), SAME(`m${n}-p`, `${M(n)} .ai-b > p`)];
  const LIST = [
    SAME("crumbs", ".bd-crumbs"), SAME("crumb-a", ".bd-crumbs a"), SAME("crumb-b", ".bd-crumbs b"),
    SAME("grid", ".as-grid"), SAME("chat", ".as-chat"), SAME("head", ".as-head"), SAME("title", ".as-title"), SAME("spark", ".as-spark"), SAME("h3", ".as-title h3"), SAME("chip", ".as-chip"),
    SAME("quota", ".as-quota"), SAME("q", ".as-quota .ai-q"), SAME("resets", ".as-quota small"), SAME("cd", ".as-quota .ai-cd"), SAME("hint", ".as-hint"),
    SAME("scroll", ".as-scroll"), SAME("list", ".ai-list"), ...msg(1), ...msg(2), ...msg(3), ...msg(4),
    SAME("src", ".ai-src"), SAME("src-l", ".ai-src-l"), SAME("src-a1", ".ai-src a:nth-of-type(1)"), SAME("src-a1-svg", ".ai-src a:nth-of-type(1) svg"), SAME("src-a1-t", ".ai-src a:nth-of-type(1) span"), SAME("src-a2", ".ai-src a:nth-of-type(2)"), SAME("src-a2-b", ".ai-src a:nth-of-type(2) b"),
    SAME("typing", ".ai-dots"), SAME("typing-i", ".ai-dots i:nth-child(1)"),
    SAME("empty", ".ai-empty"), SAME("empty-b", ".ai-empty b"), SAME("empty-p", ".ai-empty p"), SAME("sg", ".ai-sg button"),
    SAME("foot", ".as-foot"), SAME("max", ".ai-max:not([hidden])"), SAME("max-svg", ".ai-max svg"), SAME("max-b", ".ai-max b"), SAME("max-d", ".ai-max > span"), SAME("max-cd", ".ai-max .ai-cd"),
    SAME("comp", ".ai-comp"), SAME("ta", ".ai-comp textarea"), SAME("send", ".ai-send"), SAME("send-svg", ".ai-send svg"), SAME("note", ".as-foot > .ai-note:last-child"),
    SAME("side", ".as-side"), SAME("illu", ".as-side .il-illu"), SAME("svg", ".as-side svg"), SAME("float1", ".as-side svg g.il-float:nth-of-type(2)"), SAME("float2", ".as-side svg g.il-float:nth-of-type(3)"), SAME("float3", ".as-side svg g.il-float:nth-of-type(4)"),
    SAME("body-c", ".as-side svg .il-body"), SAME("head-c", ".as-side svg .il-head"), SAME("fist", ".as-side svg .il-fist"),
    SAME("caps", ".as-side .il-caps"), SAME("cap-on", ".as-side .il-cap.is-on"), SAME("pager", ".as-side .il-pager"), SAME("dot-on", ".as-side .il-pager button.is-on"),
  ];
  // who = persona (reference role + real account), scn = reference scenario, text = typed into the composer, enter = press Enter, wait = ms after Enter before measuring
  const STATES = [
    { name: "empty", who: "mohand", role: "owner", scn: "empty" },
    { name: "full", who: "sarah", role: "admin", scn: "full" },
    { name: "quota", who: "leo", role: "member", scn: "quota" },
    { name: "typed", who: "sarah", role: "admin", scn: "full", text: "What is Veyro?" },
    { name: "multiline", who: "sarah", role: "admin", scn: "full", text: "first line\nsecond line\nthird line" },
    { name: "typing", who: "sarah", role: "admin", scn: "full", text: "What is Veyro?", enter: true, wait: 350, mode: "stall" },
    { name: "error", who: "sarah", role: "admin", scn: "error", text: "What is Veyro?", enter: true, wait: 2200, mode: "fail" },
    { name: "cap3", who: "sarah", role: "admin", scn: "full", cap: 3 },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity", "fill", "stroke"];
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
      if (t && !/prototype view/i.test(t)) texts.push(t);
    }
    out.__texts = texts;
    const ta = root.querySelector(".ai-comp textarea"), sc = root.querySelector(".as-scroll");
    out.__ta = [ta?.value ?? null, ta?.disabled ?? null];
    out.__send = root.querySelector(".ai-send")?.disabled ?? null;
    out.__toast = document.querySelector(".ap-toast.show")?.textContent ?? null;
    out.__scroll = sc ? [sc.scrollHeight - sc.clientHeight - sc.scrollTop <= 2, sc.scrollHeight > sc.clientHeight] : null;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st, ms) => {
    if (st.text !== undefined) await page.fill(".ai-comp textarea", st.text);
    if (st.cap && page.viewportSize().width >= 1100) await page.click(`.as-side .il-pager button:nth-child(${st.cap})`);
    if (st.enter) { await page.press(".ai-comp textarea", "Enter"); await wait(st.wait); }
    else await wait(st.cap ? 1200 : 500);
  };
  const SEND = /\/api\/v1\/ai\/conversations\/[^/]+\/messages$/;

  const report = {};
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const c of COMBOS) {
    await page.setViewportSize({ width: c.w, height: c.w >= 1000 ? 900 : 844 });
    for (const st of STATES) {
      if (ONLY && !ONLY.includes(st.name)) continue;
      const key = `${st.name} ${c.w} ${c.lang} ${c.theme}`;
      await page.goto(REF, { waitUntil: "load" });
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", a.role); localStorage.setItem("veyro-theme", a.c.theme); localStorage.setItem("veyro-theme-pref", a.c.theme); localStorage.setItem("veyro-lang", a.c.lang); localStorage.setItem("veyro-sb", "0"); }, { role: st.role, c });
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.selectOption("#as-scn", st.scn);
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      await wait(2500);
      await act(st);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.unroute(SEND).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, SEED[st.who]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      if (st.mode === "stall") await page.route(SEND, async (r) => { if (r.request().method() === "POST") { await new Promise((res) => setTimeout(res, 8000)); await r.abort().catch(() => {}); } else await r.continue(); });
      if (st.mode === "fail") await page.route(SEND, (r) => (r.request().method() === "POST" ? r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "AI_GATEWAY_ERROR", message: "Generation failed" } }) }) : r.continue()));
      await page.goto(`${NEXT}/${c.lang}/assistant`, { waitUntil: "networkidle" });
      await page.waitForSelector(".as-chat", { timeout: 60000 }).catch(() => {});
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
      report[key] = { composer: [A.__ta, B.__ta], send: [A.__send, B.__send], toast: [A.__toast, B.__toast], scroll: [A.__scroll, B.__scroll], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 40) };
    }
  }
  return report;
}
