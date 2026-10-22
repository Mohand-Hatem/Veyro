// Runs a parity harness (an `async (page) => {...}` file) from the command line with the installed Chrome, for when the Playwright MCP is not available.
// Usage: PLAYWRIGHT_CORE=<path to playwright-core> node scripts/parity/run.mjs scripts/parity/work.js
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const file = process.argv[2];
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await (await browser.newContext()).newPage();
  const fn = (0, eval)(`(${fs.readFileSync(file, "utf8")})`);
  console.log(JSON.stringify(await fn(page)));
} finally {
  await browser.close();
}
