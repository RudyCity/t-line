"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { stageNoBundleResources, sha256 } = require("./stage-tauri-no-bundle-resources.cjs");

test("stages fresh no-bundle backend and runtime with exact hashes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tline-no-bundle-stage-"));
  try {
    const backend = path.join(root, "desktop-tauri", "backend", "dist");
    const bunRuntime = path.join(root, "desktop-tauri", "bun-runtime");
    fs.mkdirSync(backend, { recursive: true });
    fs.mkdirSync(bunRuntime, { recursive: true });
    fs.writeFileSync(path.join(backend, "server.js"), "server-v2");
    fs.writeFileSync(path.join(backend, "backendIdentity.js"), "router.get('/desktop/identity'); const p='tline-backend-v1';");
    fs.writeFileSync(path.join(root, "desktop-tauri", "backend", "package.json"), "{}");
    const bunName = process.platform === "win32" ? "bun.exe" : "bun";
    fs.writeFileSync(path.join(bunRuntime, bunName), "bun-runtime");
    const release = path.join(root, "release");
    fs.mkdirSync(path.join(release, "_up_", "backend", "dist"), { recursive: true });
    fs.writeFileSync(path.join(release, "_up_", "backend", "dist", "server.js"), "stale-server");

    const result = stageNoBundleResources(root, release);
    assert.equal(
      result.serverSha256,
      sha256(path.join(root, "desktop-tauri", "backend", "dist", "server.js"))
    );
    assert.equal(
      fs.readFileSync(path.join(release, "_up_", "backend", "dist", "server.js"), "utf8"),
      "server-v2"
    );
    assert.match(
      fs.readFileSync(path.join(release, "_up_", "backend", "dist", "backendIdentity.js"), "utf8"),
      /desktop\/identity/
    );
    assert.equal(
      fs.readFileSync(path.join(release, "bun-runtime", bunName), "utf8"),
      "bun-runtime"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
