#!/usr/bin/env bun
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { stageNoBundleResources } = require("./stage-tauri-no-bundle-resources.cjs");
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
if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}
if (process.argv.includes("--no-bundle")) {
  const evidence = stageNoBundleResources(root);
  process.stdout.write("Raw no-bundle runtime resources synchronized: " + JSON.stringify(evidence) + "\n");
}
process.exit(0);
