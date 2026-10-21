"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "desktop-tauri", "src-tauri", "tauri.conf.json");
const version = JSON.parse(fs.readFileSync(configPath, "utf8")).version;
const exe = path.join(root, "desktop-tauri", "src-tauri", "target", "release", "bundle", "nsis", "t-line_" + version + "_x64-setup.exe");
function inspectListing(output) {
  const paths = output.replace(/\\/g, "/").toLowerCase();
  const server = /(?:^|[\s/])backend\/dist\/server\.js(?:\s|$)/m.test(paths);
  const native = /backend\/node_modules\/better-sqlite3\/build\/release\/better_sqlite3\.node(?:\s|$)/m.test(paths);
  const dependencies = /backend\/node_modules\/http-proxy\/package\.json(?:\s|$)/m.test(paths);
  const manifest = /backend\/package\.json(?:\s|$)/m.test(paths);
  const nodeRuntime = /node-runtime\/node\.exe(?:\s|$)/m.test(paths);
  const nodeLicense = /node-runtime\/license(?:\s|$)/m.test(paths);
  return { server, native, dependencies, manifest, nodeRuntime, nodeLicense };
}
function available7z() {
  const common = process.platform === "win32"
    ? ["C:\\Program Files\\7-Zip\\7z.exe", "C:\\Program Files (x86)\\7-Zip\\7z.exe"]
    : ["/usr/bin/7z", "/usr/local/bin/7z"];
  return common.find(fs.existsSync) ?? "7z";
}
function compareStagedBackend() {
  const source = path.join(root, "backend", "dist");
  const staged = path.join(root, "desktop-tauri", "backend", "dist");
  const failures = [];
  function scan(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
      failures.push("missing dist directory");
      return;
    }
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const from = path.join(sourceDir, entry.name);
      const to = path.join(targetDir, entry.name);
      if (!fs.existsSync(to)) { failures.push(path.relative(source, from)); continue; }
      if (entry.isDirectory()) scan(from, to);
      else if (entry.isFile() && !fs.readFileSync(from).equals(fs.readFileSync(to))) {
        failures.push(path.relative(source, from));
      }
      if (failures.length >= 8) return;
    }
  }
  scan(source, staged);
  const manifest = path.join(root, "backend", "package.json");
  const packagedManifest = path.join(root, "desktop-tauri", "backend", "package.json");
  if (!fs.existsSync(packagedManifest) ||
      !fs.readFileSync(manifest).equals(fs.readFileSync(packagedManifest))) failures.push("package.json");
  return failures;
}
function inspectInstaller() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const staging = compareStagedBackend();
  if (staging.length) return { status: "blocked", description:
    "Staged backend differs from the current build: " + staging.join(", ") };
  const nodeRuntime = path.join(root, "desktop-tauri", "node-runtime", "node.exe");
  const nodeLicense = path.join(root, "desktop-tauri", "node-runtime", "LICENSE");
  if (!fs.existsSync(nodeRuntime) || !fs.existsSync(nodeLicense)) {
    return { status: "blocked", description: "Bundled Node.js runtime and license are required" };
  }
  const mapping = config.bundle?.resources;
  const expected = {
    "../backend/dist/": "backend/dist/",
    "../backend/node_modules/": "backend/node_modules/",
    "../backend/package.json": "backend/package.json",
    "../node-runtime/": "node-runtime/",
  };
  const mapped = Object.entries(expected).every(([key, value]) => mapping?.[key] === value);
  if (!mapped) return { status: "blocked", description: "Tauri bundle missing explicit backend resources mapping" };
  if (!fs.existsSync(exe)) return { status: "blocked", description: "No Windows NSIS installer has been generated" };
  if (fs.statSync(exe).mtimeMs < fs.statSync(configPath).mtimeMs) {
    return { status: "blocked", description: "Existing NSIS installer is older than resource configuration" };
  }
  const listing = spawnSync(available7z(), ["l", "-ba", exe], {
    encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  if (listing.status !== 0) return { status: "unverified", description: "Cannot inspect NSIS archive: 7-Zip unavailable or failed" };
  const payload = inspectListing(listing.stdout);
  const missing = Object.entries(payload).filter(([, found]) => !found).map(([name]) => name);
  if (missing.length) return { status: "blocked", description:
    "NSIS archive missing backend payload: " + missing.join(", ") };
  // Do not compare timestamps from successive deterministic builds: TypeScript and
  // Vite regularly rewrite unchanged outputs. Compare the actual installer bytes.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tline-nsis-verify-"));
  try {
    const relative = [
      "backend/dist/server.js",
      "backend/dist/previewProxy.js",
      "backend/dist/securePreviewProxy.js",
      "backend/package.json",
      "node-runtime/node.exe",
      "node-runtime/LICENSE",
    ];
    const archive = spawnSync(available7z(), [
      "x", "-y", "-o" + temp, exe, ...relative,
    ], { encoding: "utf8", timeout: 40000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    if (archive.error || archive.status !== 0) return { status: "unverified", description:
      "Cannot extract installer backend to verify source bytes" };
    const mismatched = relative.filter(file => {
      const from = path.join(root, ...(file.startsWith("node-runtime/") ? ["desktop-tauri"] : []),
        file.replaceAll("/", path.sep));
      const extracted = path.join(temp, file.replaceAll("/", path.sep));
      return !fs.existsSync(from) || !fs.existsSync(extracted) ||
        !fs.readFileSync(from).equals(fs.readFileSync(extracted));
    });
    if (mismatched.length) return { status: "blocked", description:
      "NSIS backend/runtime differs from current compiled source: " + mismatched.join(", ") };
    // Verify the installer runtime is executable without any globally installed node.exe.
    const embeddedNode = path.join(temp, "node-runtime", "node.exe");
    const node = spawnSync(embeddedNode, ["-v"], { timeout: 12000, encoding: "utf8",
      env: { ...process.env, PATH: "" }, windowsHide: true });
    if (node.status !== 0 || !/^v\d+\.\d+\.\d+/.test(node.stdout.trim())) {
      return { status: "blocked", description: "Bundled Node.js cannot start without system PATH" };
    }
    return { status: "pass", description:
      "NSIS contains byte-matched backend, licensed Node.js runtime, native SQLite, and HTTP proxy (installed-app E2E still needed)" };
  } finally {
    try { fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
    catch { /* no status change; temp cleanup may be delayed by Windows antivirus */ }
  }
}
if (require.main === module) {
  const status = inspectInstaller();
  process.stdout.write(JSON.stringify(status, null, 2) + "\n");
  if (status.status !== "pass") process.exitCode = 1;
}
module.exports = { inspectListing, inspectInstaller };
