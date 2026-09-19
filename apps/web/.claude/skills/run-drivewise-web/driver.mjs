#!/usr/bin/env node
// Minimal chromium-cli-alike REPL for driving apps/web's dev server, for use
// when the `chromium-cli` tool isn't available in this environment. Reads
// commands from stdin, one per line. Commands:
//
//   nav <url>                    navigate
//   wait-for text=<substr>       wait until page text contains <substr>
//   wait-for <css-selector>      wait until selector is visible
//   click <css-selector>         click an element
//   fill <css-selector> <text>   type into an input (fires React onChange)
//   press <key>                  press a key (e.g. Enter) on the focused element
//   screenshot [name]            save a PNG to SHOTS_DIR (env, default /tmp/drivewise-shots)
//   console                      print collected page console errors so far
//   eval <js>                    evaluate JS in the page, print the result
//   quit                         close the browser and exit
//
// Usage:
//   SHOTS_DIR=/tmp/drivewise-shots node driver.mjs <<'EOF'
//   nav http://localhost:3000/login
//   ...
//   EOF
import { chromium } from "playwright";
import readline from "node:readline";
import path from "node:path";
import fs from "node:fs";

const SHOTS_DIR = process.env.SHOTS_DIR || "/tmp/drivewise-shots";
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// Pinned to this container's pre-fetched Chromium revision — the project's
// own `playwright` devDependency version can drift ahead of what's cached
// at /opt/pw-browsers, and playwright then tries (and fails, offline) to
// download a different revision unless pointed at the executable directly.
const CHROME_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

let shotCount = 0;

async function handle(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  const [cmd, ...rest] = trimmed.split(" ");
  const arg = rest.join(" ");
  try {
    switch (cmd) {
      case "nav":
        await page.goto(arg, { waitUntil: "domcontentloaded" });
        console.log(`OK nav ${arg}`);
        break;
      case "wait-for":
        if (arg.startsWith("text=")) {
          const needle = arg.slice(5);
          await page.waitForFunction((n) => document.body.innerText.includes(n), needle, { timeout: 15000 });
        } else {
          await page.waitForSelector(arg, { timeout: 15000, state: "visible" });
        }
        console.log(`OK wait-for ${arg}`);
        break;
      case "click":
        await page.click(arg, { timeout: 10000 });
        console.log(`OK click ${arg}`);
        break;
      case "fill": {
        const sp = arg.indexOf(" ");
        const selector = sp === -1 ? arg : arg.slice(0, sp);
        const text = sp === -1 ? "" : arg.slice(sp + 1);
        await page.fill(selector, text, { timeout: 10000 });
        console.log(`OK fill ${selector}`);
        break;
      }
      case "press":
        await page.keyboard.press(arg);
        console.log(`OK press ${arg}`);
        break;
      case "screenshot": {
        shotCount += 1;
        const name = arg || `shot-${shotCount}`;
        const file = path.join(SHOTS_DIR, `${name}.png`);
        await page.screenshot({ path: file });
        console.log(`OK screenshot ${file}`);
        break;
      }
      case "console":
        console.log(consoleErrors.length ? consoleErrors.join("\n") : "OK console (no errors)");
        break;
      case "eval": {
        const result = await page.evaluate(arg);
        console.log(`OK eval => ${JSON.stringify(result)}`);
        break;
      }
      case "quit":
        await browser.close();
        process.exit(0);
        break; // eslint-disable-line no-unreachable
      default:
        console.log(`ERR unknown command: ${cmd}`);
    }
  } catch (error) {
    console.log(`ERR ${cmd}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// readline emits all buffered "line" events synchronously (e.g. when stdin
// is a heredoc), so without this queue, commands would fire concurrently
// instead of in the order they were written.
let queue = Promise.resolve();
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  queue = queue.then(() => handle(line));
});
rl.on("close", async () => {
  await queue;
  await browser.close();
  process.exit(0);
});
