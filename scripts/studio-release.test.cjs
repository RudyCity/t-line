"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { parseAudit } = require("./check-studio-release.cjs");
const { inspectListing, newerFrontendInputs } = require("./check-tauri-bundle.cjs");

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
test("Bun audit format blocks high or critical advisories", () => {
  const report = parseAudit(JSON.stringify({
    "proxy-addr": [{ severity: "critical", url: "https://example.test/issue" }],
    qs: [{ severity: "moderate" }]
  }), "bun");
  assert.equal(report.status, "blocked");
  assert.match(report.explanation, /proxy-addr/);
});
test("Bun audit format accepts an empty successful advisory list", () => {
  assert.equal(parseAudit("{}", "bun").status, "pass");
});

test("Tauri CLI wrapper normalizes CI to true on Windows without building", () => {
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "run-tauri-build.cjs"), "--verify-env",
  ], { env: { ...process.env, CI: "1" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout);
  assert.equal(info.ci, "true");
  assert.equal(info.command[0], "bun");
  assert.equal(info.command.at(-1), "build");
  assert.match(info.command[1].replaceAll("\\", "/"), /desktop-tauri\/node_modules\/@tauri-apps\/cli\/tauri\.js$/);
  assert.equal(info.command.length, 3);
});

test("requires backend and native runtime in real NSIS archive listing", () => {
  const valid = [
    '2026-10-21 ....A _up_/backend/dist/server.js',
    '2026-10-21 ....A _up_/backend/node_modules/http-proxy/package.json',
    '2026-10-21 ....A _up_/backend/package.json',
    '2026-10-21 ....A bun-runtime/bun.exe',
    '2026-10-21 ....A bun-runtime/LICENSE.md',
  ].join(String.fromCharCode(10));
  assert.deepEqual(inspectListing(valid), {
    server: true, dependencies: true, manifest: true, bunRuntime: true, bunLicense: true,
  });
  assert.equal(inspectListing("2026-10-21 ....A app.exe").server, false);
  assert.equal(inspectListing("2026-10-21 ....A app.exe").bunRuntime, false);
  assert.equal(inspectListing("2026-10-21 ....A app.exe").bunLicense, false);
});

test("installer freshness gate detects rebuilt UI or modified frontend source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-release-freshness-"));
  try {
    const src = path.join(root, "frontend", "src");
    const dist = path.join(root, "frontend", "dist");
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(dist, { recursive: true });
    const files = [
      path.join(root, "frontend", "index.html"),
      path.join(src, "StudioTab.tsx"),
      path.join(dist, "index.html")
    ];
    for (const file of files) {
      fs.writeFileSync(file, "verified local fixture");
      fs.utimesSync(file, new Date(10000), new Date(10000));
    }
    const compiledAt = 30000;
    assert.deepEqual(newerFrontendInputs(compiledAt, root), []);
    fs.utimesSync(files[1], new Date(35000), new Date(35000));
    assert.ok(newerFrontendInputs(compiledAt, root).some(p => p.endsWith("StudioTab.tsx")));
    fs.utimesSync(files[1], new Date(10000), new Date(10000));
    fs.utimesSync(files[2], new Date(35000), new Date(35000));
    assert.ok(newerFrontendInputs(compiledAt, root).some(p => p.endsWith("index.html")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("installer freshness gate fails closed if compiled UI is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-release-missing-"));
  try {
    assert.ok(newerFrontendInputs(Date.now(), root).some(s => s.includes("missing")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
