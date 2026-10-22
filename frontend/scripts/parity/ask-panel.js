// Parity Gate for the quick-ask drawer (SCR-AI-01) and its embedded proposal card (SCR-AI-02).
// Reference: screens/groups/03-workspace-dashboard/index.html with screens/groups/05-ai-assistant/ai-panel.js (opened from the top-bar .ap-ai button; the AI scenario is set with window.Ai.setScn).
// Next: the same button in the shell of /{lang}/w/acme-eng.
// Run with the Playwright MCP (filename = this file) or from the shell: node scripts/parity/run.mjs scripts/parity/ask-panel.js
// The static server must be on :4173, the frontend on :3000 and the backend on :5000. Motion is switched off (reduced-motion) so geometry is stable.
// The seed (backend/tmp-seed67.ts) gives every state its own person, because Confirm and Reject really change the proposal: empty, full, confirm, reject, quota, demoted. SEED is stale after cleanup.
// "typing" and "error" answer the send request from the harness (a long stall, a 502) so no real message is spent; the confirm, reject and lost-rights states hit the real server.
async (page) => {
  const REF = "http://localhost:4173/screens/groups/03-workspace-dashboard/index.html";
  const NEXT = "http://localhost:3000";
  const SEED = {"empty": "empty.dr67.mvi7ha3g@veyro-test.io", "full": "full.dr67.mvi7ha3g@veyro-test.io", "confirm": "confirm.dr67.mvi7ha3g@veyro-test.io", "reject": "reject.dr67.mvi7ha3g@veyro-test.io", "quota": "quota.dr67.mvi7ha3g@veyro-test.io", "demoted": "demoted.dr67.mvi7ha3g@veyro-test.io"};
  const CFG = typeof process !== "undefined" && process.env.PARITY_CFG ? JSON.parse(process.env.PARITY_CFG) : {};
  const COMBOS = CFG.combos ?? [{"w": 1440, "lang": "en", "theme": "light"}];
  const ONLY = CFG.states ?? null;
  const SAME = (label, sel) => [label, sel, sel];
  const M = (n) => `.ai-m:nth-child(${n})`;
  const msg = (n) => [SAME(`m${n}`, M(n)), SAME(`m${n}-av`, `${M(n)} .ai-av`), SAME(`m${n}-bt`, `${M(n)} .ai-bt`), SAME(`m${n}-who`, `${M(n)} .ai-bt b`), SAME(`m${n}-time`, `${M(n)} small`), SAME(`m${n}-p`, `${M(n)} .ai-b > p`)];
  const LIST = [
    SAME("panel", ".aip"), SAME("head", ".aip-head"), SAME("hrow", ".aip-hrow:nth-child(1)"), SAME("spark", ".aip-spark"), SAME("h2", ".aip-head h2"), SAME("full", ".aip-full"), SAME("x", ".aip-x"),
    SAME("sub", ".aip-sub"), SAME("ctx", ".aip-ctx"), SAME("ctx-svg", ".aip-ctx svg"), SAME("ctx-t", ".aip-ctx > span"), SAME("q", ".aip .ai-q"),
    SAME("scroll", ".aip-scroll"), SAME("list", ".ai-list"), ...msg(1), ...msg(2), ...msg(3), ...msg(4), ...msg(5),
    SAME("card", ".ai-pc"), SAME("card-h", ".ai-pc-h"), SAME("card-h-svg", ".ai-pc-h svg"), SAME("card-h-b", ".ai-pc-h b"), SAME("card-t", ".ai-pc-t"), SAME("card-d", ".ai-pc-d"), SAME("dt1", ".ai-pc-d > div:nth-child(1) dt"), SAME("dd1", ".ai-pc-d > div:nth-child(1) dd"), SAME("key", ".ai-pc .ap-key"), SAME("dt2", ".ai-pc-d > div:nth-child(2) dt"), SAME("prio", ".ai-pc .pr"),
    SAME("act", ".ai-pc-act"), SAME("confirm", ".ai-pc-act .pm-go"), SAME("reject", ".ai-pc-act .pm-ghost"), SAME("free", ".ai-pc-act small"),
    SAME("res", ".ai-pc-res"), SAME("res-b", ".ai-pc-res b"), SAME("res-a", ".ai-pc-res a"), SAME("err", ".ai-pc-err:not([hidden])"),
    SAME("typing", ".ai-dots"), SAME("empty", ".ai-empty"), SAME("empty-b", ".ai-empty b"), SAME("empty-p", ".ai-empty p"), SAME("sg1", ".ai-sg button:nth-child(1)"), SAME("sg2", ".ai-sg button:nth-child(2)"),
    SAME("foot", ".aip-foot"), SAME("max", ".ai-max:not([hidden])"), SAME("max-svg", ".ai-max svg"), SAME("max-b", ".ai-max b"), SAME("max-d", ".ai-max > span"),
    SAME("comp", ".ai-comp"), SAME("ta", ".ai-comp textarea"), SAME("send", ".ai-send"), SAME("note", ".aip-foot > .ai-note:last-child"),
  ];
  // who = persona, role = reference role, scn = reference AI scenario, text = typed, enter = press Enter, click = card button, wait = ms before measuring
  const STATES = [
    { name: "empty", who: "empty", scn: "empty" },
    { name: "full", who: "full", scn: "full" },
    { name: "quota", who: "quota", scn: "quota" },
    { name: "typed", who: "full", scn: "full", text: "What is Veyro?" },
    { name: "typing", who: "full", scn: "full", text: "What is Veyro?", enter: true, wait: 350, mode: "stall" },
    { name: "error", who: "full", scn: "error", text: "What is Veyro?", enter: true, wait: 2200, mode: "fail" },
    { name: "confirmed", who: "confirm", scn: "full", click: ".ai-pc-act .pm-go", wait: 2500 },
    { name: "rejected", who: "reject", scn: "full", click: ".ai-pc-act .pm-ghost", wait: 2500 },
    { name: "demoted", who: "demoted", scn: "demoted", click: ".ai-pc-act .pm-go", wait: 2500 },
  ];
  const PROPS = ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor", "borderTopWidth", "borderTopColor", "borderTopLeftRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "letterSpacing", "lineHeight", "textDecorationLine", "textAlign", "boxShadow", "display", "opacity", "fill", "stroke"];
  const mask = (t) => t.replace(/\d+/g, "#");
  const wait = (ms) => page.waitForTimeout(ms);

  const measure = (args) => page.evaluate(({ list, props }) => {
    const root = document.querySelector("#aip");
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
    const ta = root.querySelector(".ai-comp textarea"), sc = root.querySelector(".aip-scroll");
    out.__ta = [ta?.value ?? null, ta?.disabled ?? null];
    out.__send = root.querySelector(".ai-send")?.disabled ?? null;
    out.__toast = document.querySelector(".ap-toast.show")?.textContent ?? null;
    out.__card = [...root.querySelectorAll(".ai-pc")].map((c) => c.className.replace(/\s+/g, " ").trim()).join("|");
    out.__expanded = document.querySelector(".ap-ai")?.getAttribute("aria-expanded") ?? null;
    out.__scroll = sc ? [sc.scrollHeight - sc.clientHeight - sc.scrollTop <= 2, sc.scrollHeight > sc.clientHeight] : null;
    out.__scrollW = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  }, args);

  const act = async (st, openWait) => {
    // phones hide the top-bar button (the bottom bar opens the full page), so there the drawer is opened with its keyboard shortcut
    if (await page.locator(".ap-ai").isVisible()) await page.click(".ap-ai"); else await page.keyboard.press("Control+j");
    await page.waitForFunction(() => document.querySelector("#aip")?.classList.contains("is-open"), null, { timeout: 15000 });
    await wait(openWait);
    if (st.text !== undefined) await page.fill(".aip .ai-comp textarea", st.text);
    if (st.enter) { await page.press(".aip .ai-comp textarea", "Enter"); await wait(st.wait); }
    if (st.click) { await page.click(`.aip ${st.click}`); await wait(st.wait); }
    await wait(500);
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
      await page.evaluate((a) => { sessionStorage.clear(); sessionStorage.setItem("veyro-proto-role", "admin"); localStorage.setItem("veyro-theme", a.theme); localStorage.setItem("veyro-theme-pref", a.theme); localStorage.setItem("veyro-lang", a.lang); localStorage.setItem("veyro-sb", "0"); }, c);
      await page.goto(REF, { waitUntil: "load" });
      if ((await page.evaluate(() => document.documentElement.lang)) !== c.lang) await page.click(".js-lang-toggle");
      await page.evaluate(() => document.querySelector(".ap-proto")?.remove());
      // The drawer is shown on pages that load settings.css (the board, the assistant), where the card buttons are the small 36px ones (.st-sm); the dashboard page of the reference does not load it.
      await page.addStyleTag({ content: ".st-sm{min-height:36px;padding:0 16px;font-size:.8125rem}.st-sm[aria-busy=true]{opacity:.6;pointer-events:none}" });
      await page.waitForFunction(() => window.Ai && document.querySelector("#aip"), null, { timeout: 15000 });
      await page.evaluate((scn) => window.Ai.setScn(scn), st.scn);
      await wait(1500);
      console.error('stage ref act', key);
      await act(st, 1200);
      const A = await measure({ list: LIST.map((l) => [l[0], l[1]]), props: PROPS });
      await page.context().clearCookies();
      await page.unroute(SEND).catch(() => {});
      await page.goto(`${NEXT}/${c.lang}/login`, { waitUntil: "networkidle" });
      const ok = await page.evaluate(async (email) => (await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Passw0rd!long" }) })).status, SEED[st.who]);
      if (ok !== 200) { report[key] = `login failed ${ok}`; continue; }
      await page.evaluate((a) => { localStorage.setItem("theme", a.theme); localStorage.setItem("veyro-sb", "0"); }, c);
      if (st.mode === "stall") await page.route(SEND, async (r) => { if (r.request().method() === "POST") { await new Promise((res) => setTimeout(res, 8000)); await r.abort().catch(() => {}); } else await r.continue(); });
      if (st.mode === "fail") await page.route(SEND, (r) => (r.request().method() === "POST" ? r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "AI_GATEWAY_ERROR", message: "Generation failed" } }) }) : r.continue()));
      await page.goto(`${NEXT}/${c.lang}/w/acme-eng`, { waitUntil: "networkidle" });
      await page.waitForSelector(".ap-ai", { timeout: 60000 }).catch(() => {});
      await wait(2500);
      console.error('stage next act', key, page.url());
      await act(st, 1500);
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
      report[key] = { composer: [A.__ta, B.__ta], send: [A.__send, B.__send], toast: [A.__toast, B.__toast], card: [A.__card, B.__card], expanded: [A.__expanded, B.__expanded], scroll: [A.__scroll, B.__scroll], overflowPx: [A.__scrollW, B.__scrollW], missing: [...new Set(ta.filter((t) => !tb.includes(t)))], extra: [...new Set(tb.filter((t) => !ta.includes(t)))], n: diffs.length, diffs: diffs.slice(0, 40) };
    }
  }
  return report;
}
