"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { parseAudit } = require("./check-motion-release.cjs");
const { inspectListing } = require("./check-tauri-bundle.cjs");

test("blocks high and critical production advisories without claiming automatic fixes", () => {
  const result = parseAudit(JSON.stringify({
    metadata: { vulnerabilities: { high: 3, critical: 0 } },
    vulnerabilities: {
      braces: { severity: "high" },
      micromatch: { severity: "high" },
      "http-proxy-middleware": { severity: "high" },
    },
  }));
  assert.equal(result.status, "blocked");
  assert.match(result.explanation, /braces/);
  assert.match(result.explanation, /3 high\/critical/);
});

test("only reports clean dependency gate when registry says no severe advisories", () => {
  const result = parseAudit(JSON.stringify({
    metadata: { vulnerabilities: { high: 0, critical: 0 } },
    vulnerabilities: { occasional: { severity: "moderate" } },
  }));
  assert.equal(result.status, "pass");
});
test("fails closed on malformed or incomplete audit output", () => {
  assert.equal(parseAudit("{invalid").status, "unverified");
  assert.equal(parseAudit("{}").status, "unverified");
});
test("Tauri CLI wrapper normalizes CI to true on Windows without building", () => {
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "run-tauri-build.cjs"), "--verify-env",
  ], { env: { ...process.env, CI: "1" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout);
  assert.equal(info.ci, "true");
  assert.deepEqual(info.command, ["bun", "run", "--filter", "desktop-tauri", "tauri", "build"]);
});

test("requires backend and native runtime in real NSIS archive listing", () => {
  const valid = [
    '2026-10-21 ....A _up_/backend/dist/server.js',
    '2026-10-21 ....A _up_/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
    '2026-10-21 ....A _up_/backend/node_modules/http-proxy/package.json',
    '2026-10-21 ....A _up_/backend/package.json',
  ].join(String.fromCharCode(10));
  assert.deepEqual(inspectListing(valid), {
    server: true, native: true, dependencies: true, manifest: true,
  });
  assert.equal(inspectListing("2026-10-21 ....A app.exe").server, false);
  assert.equal(inspectListing("2026-10-21 ....A app.exe").native, false);
});
