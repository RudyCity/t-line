"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function requireFile(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(label + " missing: " + file);
  }
}

function replaceTree(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error("No-bundle resource source missing: " + source);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true, dereference: false });
}

function assertSame(source, target, label) {
  requireFile(source, label + " source");
  requireFile(target, label + " staged");
  const a = sha256(source);
  const b = sha256(target);
  if (a !== b) throw new Error(label + " no-bundle staging hash mismatch");
  return a;
}

function stageNoBundleResources(root, releaseDir = path.join(root, "desktop-tauri", "src-tauri", "target", "release")) {
  const desktop = path.join(root, "desktop-tauri");
  const stagedBackend = path.join(desktop, "backend");
  const stagedBun = path.join(desktop, "bun-runtime");
  const destinationBackend = path.join(releaseDir, "_up_", "backend");
  const destinationBun = path.join(releaseDir, "bun-runtime");

  requireFile(path.join(stagedBackend, "dist", "server.js"), "staged backend server");
  requireFile(path.join(stagedBackend, "dist", "backendIdentity.js"), "staged backend identity");
  requireFile(path.join(stagedBun, process.platform === "win32" ? "bun.exe" : "bun"), "staged Bun runtime");

  replaceTree(stagedBackend, destinationBackend);
  replaceTree(stagedBun, destinationBun);

  const evidence = {
    serverSha256: assertSame(
      path.join(stagedBackend, "dist", "server.js"),
      path.join(destinationBackend, "dist", "server.js"),
      "backend server"
    ),
    identitySha256: assertSame(
      path.join(stagedBackend, "dist", "backendIdentity.js"),
      path.join(destinationBackend, "dist", "backendIdentity.js"),
      "backend identity"
    ),
    bunSha256: assertSame(
      path.join(stagedBun, process.platform === "win32" ? "bun.exe" : "bun"),
      path.join(destinationBun, process.platform === "win32" ? "bun.exe" : "bun"),
      "Bun runtime"
    ),
  };
  const identityText = fs.readFileSync(path.join(destinationBackend, "dist", "backendIdentity.js"), "utf8");
  if (!identityText.includes("/desktop/identity") || !identityText.includes("tline-backend-v1")) {
    throw new Error("No-bundle backend identity endpoint missing after staging");
  }
  return evidence;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const evidence = stageNoBundleResources(root);
  process.stdout.write("No-bundle resources staged: " + JSON.stringify(evidence) + "\n");
}

module.exports = { stageNoBundleResources, sha256 };
