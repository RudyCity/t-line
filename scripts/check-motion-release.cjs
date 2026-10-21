#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { inspectInstaller } = require("./check-tauri-bundle.cjs");

const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const asJson = process.argv.includes("--json");
function item(gate, status, explanation) { return { gate, status, explanation }; }
function probeBinary(command, args = ["-version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 10000 });
  return !result.error && result.status === 0;
}
function parseAudit(output) {
  try {
    const report = JSON.parse(output);
    const counts = report.metadata?.vulnerabilities;
    if (!counts) throw new Error("missing vulnerability summary");
    const names = Object.entries(report.vulnerabilities || {})
      .filter(([, value]) => ["high", "critical"].includes(value.severity))
      .map(([name]) => name);
    const severe = Number(counts.high || 0) + Number(counts.critical || 0);
    return item("production-backend-dependencies", severe ? "blocked" : "pass",
      severe ? `${severe} high/critical advisory item(s): ${names.join(", ")}` :
        "No high/critical advisory currently reported for production dependencies");
  } catch (error) {
    return item("production-backend-dependencies", "unverified",
      "Unable to parse npm audit response; registry access and lockfile must be verified");
  }
}
function checkAudit() {
  // The command is a fixed literal, not derived from request or environment input.
  // cmd.exe executes npm.cmd safely without Node's deprecated shell:true argument forwarding.
  const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd audit --omit=dev --json"]
    : ["audit", "--omit=dev", "--json"];
  const result = spawnSync(command, args, {
    cwd: path.join(root, "desktop-tauri", "backend"), encoding: "utf8",
    timeout: 30000, maxBuffer: 2 * 1024 * 1024, shell: false, windowsHide: true,
  });
  if (result.error || !result.stdout?.trim()) {
    return item("production-backend-dependencies", "unverified",
      "npm audit could not complete: " + String(result.error?.message ?? result.stderr ?? "").slice(0, 140));
  }
  return parseAudit(result.stdout);
}
function check() {
  const release = path.join(root, "desktop-tauri", "src-tauri", "target", "release", "app.exe");
  const gates = [
    item("frontend-backend-build", "unverified", "Run bun run build:frontend and bun run build:backend on this revision"),
    item("ffmpeg-available", probeBinary(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg") ? "pass" : "blocked",
      "Local FFmpeg is required for H264/AAC motion encoding; test platform codec output separately"),
    item("rust-tauri-release-executable", fs.existsSync(release) ? "unverified" : "blocked",
      fs.existsSync(release)
        ? "Found a local release app.exe, but its source revision/signature and installed runtime are unverified"
        : "No release app.exe found; run bun run build:tauri on Windows"),
    checkAudit(),
    { gate: "windows-nsis-backend-payload", ...(() => {
      const inspected = inspectInstaller();
      return { status: inspected.status, explanation: inspected.description };
    })() },
    item("node-runtime-prerequisite", "unverified",
      "Rust currently launches system Node.js; verify installed Node LTS on target computer or bundle approved runtime"),
    item("live-vision-provider", "unverified", "Requires authorized provider/image input and observed user E2E"),
    item("live-piper-model", "unverified", "Requires installed Piper, licensed local voice and real narration E2E"),
    item("tauri-installed-smoke", "unverified", "Requires installer, WebView2, token/auth and real workspace/media playback"),
    item("extended-render-reliability", "unverified", "Requires restart/fault-injection, stress benchmarks and font/codec parity"),
  ];
  return { project: "T-Line / SuperAgent Motion Studio", kind: "developer-preview-readiness",
    generatedAt: new Date().toISOString(), gates,
    releaseApproved: gates.every(gate => gate.status === "pass") };
}
if (require.main === module) {
  const report = check();
  if (asJson) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    process.stdout.write(report.project + " — release gates\n");
    for (const gate of report.gates) process.stdout.write("[" + gate.status + "] " + gate.gate + " — " + gate.explanation + "\n");
    process.stdout.write("Production release: " + (report.releaseApproved ? "approved by automated checks" : "NOT APPROVED") + "\n");
  }
  if (strict && !report.releaseApproved) process.exitCode = 1;
}
module.exports = { parseAudit, check };
