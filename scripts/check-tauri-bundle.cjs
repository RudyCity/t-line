"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const os = require("node:os");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "desktop-tauri", "src-tauri", "tauri.conf.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const exe = path.join(root, "desktop-tauri", "src-tauri", "target", "release", "bundle",
  "nsis", "t-line_" + config.version + "_x64-setup.exe");

function inspectListing(output) {
  const paths = output.replace(/\\/g, "/").toLowerCase();
  return {
    server: /(?:^|[\s/])backend\/dist\/server\.js(?:\s|$)/m.test(paths),
    dependencies: /backend\/node_modules\/http-proxy\/package\.json(?:\s|$)/m.test(paths),
    manifest: /backend\/package\.json(?:\s|$)/m.test(paths),
    bunRuntime: /bun-runtime\/bun\.exe(?:\s|$)/m.test(paths),
    bunLicense: /bun-runtime\/license\.md(?:\s|$)/m.test(paths)
  };
}
function available7z() {
  const candidates = process.platform === "win32"
    ? ["C:\\Program Files\\7-Zip\\7z.exe", "C:\\Program Files (x86)\\7-Zip\\7z.exe"]
    : ["/usr/bin/7z", "/usr/local/bin/7z"];
  return candidates.find(fs.existsSync) ?? "7z";
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

/** Real ConPTY smoke with no Node/npm/global Bun on the PATH. */
function verifyBundledBun(binary) {
  const executable = path.resolve(binary);
  const code = `
    const shell = require('node:path').join(process.env.SystemRoot || 'C:\\\\Windows', 'System32', 'cmd.exe');
    let buffer = '';
    const p = Bun.spawn([shell, '/d', '/c', 'echo', 'BUN_BUNDLE_PTY_OK'], {
      terminal: {
        cols: 80, rows: 24,
        data(_terminal, bytes) { buffer += new TextDecoder().decode(bytes); }
      }
    });
    const timeout = setTimeout(() => { p.kill(); process.exit(8); }, 5000);
    p.exited.then(exit => {
      clearTimeout(timeout);
      p.terminal?.close();
      if (exit === 0 && buffer.includes('BUN_BUNDLE_PTY_OK')) {
        process.stdout.write('BUN_BUNDLE_PTY_OK');
        process.exit(0);
      }
      console.error('Native terminal smoke failed', exit, buffer.slice(-300));
      process.exit(9);
    });
  `;
  const result = spawnSync(executable, ["-e", code], {
    encoding: "utf8", timeout: 15000,
    env: { ...process.env, PATH: "" }, windowsHide: true,
  });
  return result.status === 0 && result.stdout?.includes("BUN_BUNDLE_PTY_OK");
}

function inspectInstaller() {
  const staged = compareStagedBackend();
  if (staged.length) return { status: "blocked", description:
    "Staged backend differs from current build: " + staged.join(", ") };
  const bunDir = path.join(root, "desktop-tauri", "bun-runtime");
  const binary = path.join(bunDir, "bun.exe");
  const license = path.join(bunDir, "LICENSE.md");
  if (!fs.existsSync(binary) || !fs.existsSync(license)) {
    return { status: "blocked", description: "Bundled Bun runtime and license are required" };
  }
  if (process.platform === "win32" && !verifyBundledBun(binary)) {
    return { status: "blocked", description: "Staged Bun runtime cannot launch an interactive Windows PTY without global PATH" };
  }
  const mapping = config.bundle?.resources;
  const expected = {
    "../backend/dist/": "backend/dist/",
    "../backend/node_modules/": "backend/node_modules/",
    "../backend/package.json": "backend/package.json",
    "../bun-runtime/": "bun-runtime/"
  };
  if (!Object.entries(expected).every(([key, value]) => mapping?.[key] === value)) {
    return { status: "blocked", description: "Tauri bundle missing explicit Bun/backend resources mapping" };
  }
  if (!fs.existsSync(exe)) {
    return { status: "blocked", description: "No Windows NSIS installer has been generated for Bun" };
  }
  const installerTime = fs.statSync(exe).mtimeMs;
  const nativeRoot = path.join(root, "desktop-tauri", "src-tauri");
  const sourceFiles = [
    configPath,
    path.join(nativeRoot, "Cargo.toml"),
    path.join(nativeRoot, "build.rs")
  ];
  const enumerateRust = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) enumerateRust(file);
      else if (item.isFile() && file.endsWith(".rs")) sourceFiles.push(file);
    }
  };
  enumerateRust(path.join(nativeRoot, "src"));
  const changedAfterInstaller = sourceFiles.filter(file => fs.statSync(file).mtimeMs > installerTime);
  if (changedAfterInstaller.length) {
    return { status: "blocked", description:
      "Windows installer predates native Rust/config source: " +
      changedAfterInstaller.map(file => path.relative(root, file)).slice(0, 4).join(", ") };
  }
  const listing = spawnSync(available7z(), ["l", "-ba", exe], {
    encoding: "utf8", timeout: 22000, maxBuffer: 10 * 1024 * 1024, windowsHide: true
  });
  if (listing.status !== 0) {
    return { status: "unverified", description: "7-Zip cannot inspect NSIS archive" };
  }
  const payload = inspectListing(listing.stdout);
  const missing = Object.entries(payload).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) return { status: "blocked", description:
    "NSIS archive missing Bun/backend resources: " + missing.join(", ") };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tline-bun-nsis-"));
  try {
    const relative = [
      "backend/dist/server.js", "backend/dist/previewProxy.js",
      "backend/dist/securePreviewProxy.js", "backend/package.json",
      "bun-runtime/bun.exe", "bun-runtime/LICENSE.md"
    ];
    const extracted = spawnSync(available7z(), [
      "x", "-y", "-o" + temp, exe,
      ...relative, "backend/dist/*", "backend/node_modules/*"
    ], {
      encoding: "utf8", timeout: 45000, maxBuffer: 2 * 1024 * 1024, windowsHide: true
    });
    if (extracted.status !== 0) {
      return { status: "unverified", description: "Cannot extract Bun runtime/compiled backend to verify bytes" };
    }
    const mismatched = relative.filter(file => {
      const source = path.join(root, ...(file.startsWith("bun-runtime/") ? ["desktop-tauri"] : []),
        file.replaceAll("/", path.sep));
      const installed = path.join(temp, file.replaceAll("/", path.sep));
      return !fs.existsSync(source) || !fs.existsSync(installed) ||
        !fs.readFileSync(source).equals(fs.readFileSync(installed));
    });
    if (mismatched.length) return { status: "blocked", description:
      "NSIS backend/Bun differs from compiled source: " + mismatched.join(", ") };
    if (process.platform === "win32" && !verifyBundledBun(path.join(temp, "bun-runtime", "bun.exe"))) {
      return { status: "blocked", description: "Extracted Bun runtime failed native ConPTY without global PATH" };
    }
    if (process.platform === "win32") {
      // Execute the actual extracted backend with the extracted Bun executable
      // using a random loopback port and disposable home. This validates the
      // installer dependencies, not only the backend/server.js entrypoint.
      const backendSmoke = spawnSync(
        path.join(temp, "bun-runtime", "bun.exe"),
        [path.join(root, "scripts", "bun-backend-smoke.cjs")], {
          cwd: temp, encoding: "utf8", timeout: 25000, maxBuffer: 1024 * 1024,
          windowsHide: true,
          env: {
            // Backend needs built-in Windows OS commands, but not global Bun/Node.
            ...process.env, PATH: [
              path.join(process.env.SystemRoot || "C:\Windows", "System32"),
              process.env.SystemRoot || "C:\Windows"
            ].join(path.delimiter),
            TLINE_BACKEND_SMOKE_ROOT: temp,
            TLINE_BUN_RUNTIME: path.join(temp, "bun-runtime", "bun.exe")
          }
        }
      );
      if (backendSmoke.status !== 0 ||
          !backendSmoke.stdout?.includes("BUN_BACKEND_SMOKE_OK")) {
        return { status: "blocked", description:
          "Extracted backend failed clean Windows startup: " +
          String(backendSmoke.stderr || backendSmoke.stdout || backendSmoke.error || backendSmoke.status).slice(-400) };
      }
    }
    return { status: "pass", description:
      "NSIS extracted Bun ConPTY passed; backend started on loopback and protected API returned HTTP 401 (installed UI E2E still required)" };
  } finally {
    try { fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }); } catch {}
  }
}
if (require.main === module) {
  const status = inspectInstaller();
  console.log(JSON.stringify(status, null, 2));
  if (status.status !== "pass") process.exitCode = 1;
}
module.exports = { inspectListing, inspectInstaller, verifyBundledBun };
