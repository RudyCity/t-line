#!/usr/bin/env bun
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
// Invoke Tauri's JS entry using Bun directly. Package-manager shims can spawn Node.
const argv = [path.join(root, "desktop-tauri", "node_modules", "@tauri-apps", "cli", "tauri.js"), "build", ...process.argv.slice(2)];
const env = { ...process.env, CI: "true" };
if (process.argv.includes("--verify-env")) {
  process.stdout.write(JSON.stringify({ ci: env.CI, command: ["bun", ...argv.filter(a => a !== "--verify-env")] }) + "\n");
  process.exit(0);
}
const result = spawnSync(process.versions.bun ? process.execPath : (process.platform === "win32" ? "bun.exe" : "bun"), argv, {
  cwd: path.join(root, "desktop-tauri"), env, stdio: "inherit", shell: false, windowsHide: false,
});
if (result.error) {
  process.stderr.write("Tauri packaging failed to launch: " + result.error.message + "\n");
  process.exit(1);
}
process.exit(result.status ?? 1);
