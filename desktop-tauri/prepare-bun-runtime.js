"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");

// Windows keeps executables locked while running. Verify a previously staged
// runtime by its complete SHA-256 before attempting to overwrite it.
function sha256File(filePath) {
  const hash = createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let count;
    while ((count = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      hash.update(chunk.subarray(0, count));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function resolveBuildBun() {
  const executable = process.execPath;
  if (process.versions.bun && fs.existsSync(executable)) return executable;
  const windows = process.platform === "win32";
  const fallback = path.join(os.homedir(), ".bun", "bin", windows ? "bun.exe" : "bun");
  if (fs.existsSync(fallback)) return fallback;
  const selected = process.env.TLINE_BUN_BUILD_BINARY;
  if (selected && fs.existsSync(selected)) return selected;
  throw new Error("Bun executable not available for installer staging. Run the build with Bun.");
}

/** Stage an independently verified Bun runtime for clean Windows installations.
 * Bun's upstream version-pinned LICENSE.md is checked into the repository.
 */
function prepareBunRuntime(tauriDir) {
  if (process.platform !== "win32") {
    throw new Error("Bundled Bun auto-staging currently supports Windows builds only");
  }
  const executable = fs.realpathSync(resolveBuildBun());
  const version = execFileSync(executable, ["--version"], { encoding: "utf8", timeout: 10000 }).trim();
  const licensedBunVersion = "1.4.2";
  if (version !== licensedBunVersion) {
    throw new Error("Unsupported Bun runtime " + version +
      ": binary must match the pinned " + licensedBunVersion +
      " release and bundled upstream license. Review/re-pin both before upgrading.");
  }
  const license = path.join(tauriDir, "bun-license.md");
  if (!fs.existsSync(license) || fs.statSync(license).size < 1000) {
    throw new Error("Bun upstream license + linked-library notices must be available for redistribution");
  }
  const target = path.join(tauriDir, "bun-runtime");
  fs.mkdirSync(target, { recursive: true });
  const binary = path.join(target, "bun.exe");
  if (path.resolve(executable).toLowerCase() !== path.resolve(binary).toLowerCase()) {
    const identical = fs.existsSync(binary) &&
      fs.statSync(executable).size === fs.statSync(binary).size &&
      sha256File(executable) === sha256File(binary);
    if (!identical) {
      fs.copyFileSync(executable, binary);
    }
  }
  fs.copyFileSync(license, path.join(target, "LICENSE.md"));
  const stagedVersion = execFileSync(binary, ["--version"], { encoding: "utf8", timeout: 10000 }).trim();
  if (stagedVersion !== version) throw new Error("Staged Bun runtime failed version verification");
  console.log("Bundled Bun " + version + " (" + (fs.statSync(binary).size / 1048576).toFixed(1) + " MiB)");
  return { version, binary };
}

module.exports = { prepareBunRuntime, resolveBuildBun };
