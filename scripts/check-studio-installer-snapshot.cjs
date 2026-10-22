#!/usr/bin/env bun
"use strict";

/** Standalone integrity gate for the SuperAgent Studio slice of a Windows Tauri
 * installer. It intentionally does not edit or re-stage another team's release.
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const tauri = path.join(root, "desktop-tauri");
const native = path.join(tauri, "src-tauri");
const version = JSON.parse(fs.readFileSync(path.join(native, "tauri.conf.json"), "utf8")).version;
const installer = path.join(native, "target", "release", "bundle", "nsis",
  "t-line_" + version + "_x64-setup.exe");
const exe = path.join(native, "target", "release", "app.exe");
const backend = path.join(root, "backend", "dist", "studioProxy.js");
const staged = path.join(tauri, "backend", "dist", "studioProxy.js");
const frontendDir = path.join(root, "frontend", "dist", "assets");

const sha = filename => crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
const fail = reason => {
  process.stderr.write("[BLOCKED] Studio installer snapshot: " + reason + "\n");
  process.exitCode = 1;
};
function sevenZip() {
  const paths = process.platform === "win32"
    ? ["C:\\Program Files\\7-Zip\\7z.exe", "C:\\Program Files (x86)\\7-Zip\\7z.exe"]
    : ["/usr/bin/7z", "/usr/local/bin/7z"];
  return paths.find(fs.existsSync) || "7z";
}
/**
 * Tauri patches exactly three bytes when turning the release executable
 * placeholder into an NSIS executable. All other bytes must be identical.
 * The marker is intentionally strict; arbitrary PE/resource changes fail.
 */
function verifyTauriNsisExecutable(actual, source) {
  if (actual.equals(source)) return { valid: true, mode: "byte-identical" };
  if (actual.length !== source.length) return { valid: false, mode: "length-mismatch" };
  const marker = Buffer.from("BUNDLE_TYPE_VAR_", "ascii");
  // Rust/C++ linkage may embed the marker multiple times. The only accepted
  // difference remains exactly ONE source UNK → packaged NSS marker.
  const candidates = [];
  for (let offset = source.indexOf(marker); offset !== -1;
       offset = source.indexOf(marker, offset + 1)) {
    if (actual.subarray(offset, offset + marker.length).equals(marker) &&
        source.toString("ascii", offset + marker.length, offset + marker.length + 3) === "UNK" &&
        actual.toString("ascii", offset + marker.length, offset + marker.length + 3) === "NSS") {
      candidates.push(offset + marker.length);
    }
  }
  if (candidates.length !== 1) return { valid: false, mode: "expected-exactly-one-NSIS-marker-patch" };
  const normalized = Buffer.from(actual);
  source.copy(normalized, candidates[0], candidates[0], candidates[0] + 3);
  const valid = normalized.equals(source);
  return { valid, mode: valid ? "verified-NSIS-marker-patch" : "unexpected-code-or-resource-change" };
}
function run() {
  const required = [installer, exe, backend, staged, frontendDir];
  if (required.some(p => !fs.existsSync(p))) return fail("missing installer, release executable or built assets");
  const chunks = fs.readdirSync(frontendDir)
    .filter(name => /^StudioTab-[A-Za-z0-9_-]+\.js$/.test(name));
  if (chunks.length !== 1) return fail("expected one compiled StudioTab module, found " + chunks.length);
  const chunk = path.join(frontendDir, chunks[0]);
  if (sha(backend) !== sha(staged)) return fail("compiled and staged backend Motion proxies differ");
  // Backend can be recompiled byte-for-byte after the installer was written.
  // Its full contents are validated against the NSIS payload below, so only
  // native/embedded-frontend build order needs a timestamp constraint.
  const buildFiles = [exe, chunk];
  const installedTime = fs.statSync(installer).mtimeMs;
  if (buildFiles.some(file => fs.statSync(file).mtimeMs > installedTime + 1500)) {
    return fail("installer predates compiled SuperAgent Studio assets; rebuild NSIS");
  }
  if (fs.statSync(exe).mtimeMs + 1500 < fs.statSync(chunk).mtimeMs) {
    return fail("native app.exe predates SuperAgent Studio UI bundle");
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tline-studio-snapshot-"));
  try {
    const extraction = spawnSync(sevenZip(), [
      "x", "-y", "-o" + temp, installer,
      "app.exe", "backend/dist/studioProxy.js",
    ], { encoding: "utf8", timeout: 60000, windowsHide: true, maxBuffer: 1024 * 1024 });
    if (extraction.status !== 0) return fail("unable to extract release executable and Motion proxy from NSIS");
    const extractedExe = path.join(temp, "app.exe");
    const extractedProxy = path.join(temp, "backend", "dist", "studioProxy.js");
    if (![extractedExe, extractedProxy].every(fs.existsSync))
      return fail("NSIS installer omits Motion proxy or native executable");
    const nativeIdentity = verifyTauriNsisExecutable(
      fs.readFileSync(extractedExe), fs.readFileSync(exe));
    if (!nativeIdentity.valid)
      return fail("NSIS native app.exe mismatch: " + nativeIdentity.mode);
    if (sha(extractedProxy) !== sha(backend))
      return fail("NSIS Motion proxy differs from the current compiled backend");
    process.stdout.write(JSON.stringify({
      status: "pass", installer: path.basename(installer),
      nativeAppHash: sha(exe), nativeIdentity: nativeIdentity.mode, studioProxyHash: sha(backend),
      studioFrontendChunk: chunks[0], frontendBuiltBeforeNative: true,
      limits: "Build-order check does not replace installed GUI/WebView2 smoke",
    }, null, 2) + "\n");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
}
if (require.main === module) {
  try { run(); } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
}
module.exports = { verifyTauriNsisExecutable };
