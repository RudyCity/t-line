"use strict";
/** Isolated Bun runtime and terminal smoke test.
 * Run: bun scripts/bun-terminal-smoke.cjs
 * Does not start T-Line backend, SuperAgent or touch user databases.
 */
const path = require("node:path");
const { terminalManager } = require("../backend/dist/terminalManager.js");

if (!process.versions.bun) throw new Error("Terminal runtime must be Bun");
if (typeof Bun.Terminal !== "function") throw new Error("This Bun version has no native terminal support");
const id = "bun-runtime-smoke-" + process.pid;
let text = "";
let done = false;
const timeout = setTimeout(() => finish(new Error("Bun terminal timed out; output was: " + text.slice(-500))), 8000);
function finish(error) {
  if (done) return;
  done = true;
  clearTimeout(timeout);
  terminalManager.removeTerminal(id);
  if (error) {
    console.error("BUN_TERMINAL_SMOKE_FAILED", error.message);
    process.exitCode = 1;
  } else {
    console.log("BUN_TERMINAL_SMOKE_OK", process.versions.bun);
  }
}
try {
  const term = terminalManager.createTerminal(id, process.cwd(), 80, 24,
    process.platform === "win32" ? "cmd" : "bash");
  term.onData(chunk => {
    text += chunk;
    if (text.includes("BUN_TERMINAL_SMOKE_OK_OUTPUT")) finish();
  });
  term.onExit(code => {
    if (!done) finish(new Error("terminal exited before output, code " + code));
  });
  term.resize(100, 32);
  setTimeout(() => {
    term.write(process.platform === "win32" ? "echo BUN_TERMINAL_SMOKE_OK_OUTPUT\r" : "echo BUN_TERMINAL_SMOKE_OK_OUTPUT\n");
  }, 100);
} catch (error) { finish(error); }
