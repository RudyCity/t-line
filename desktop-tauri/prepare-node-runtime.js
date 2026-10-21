"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

/** Copy a licensed system Node.js binary into build-only Tauri resources. */
function prepareNodeRuntime(tauriDir) {
  if (process.platform !== "win32") {
    // Other platforms require independently supplied, licensed runtimes.
    throw new Error("Bundled Node.js auto-staging currently supports Windows builds only");
  }
  const executable = fs.realpathSync(process.execPath);
  const version = execFileSync(executable, ["-p", "JSON.stringify({version:process.versions.node,name:process.release.name})"],
    { encoding: "utf8", timeout: 10000 }).trim();
  const meta = JSON.parse(version);
  const major = Number(meta.version.split(".")[0]);
  if (meta.name !== "node" || !Number.isInteger(major) || major < 20 || major > 26) {
    throw new Error("Bundling requires a supported official Node.js runtime (20–26)");
  }
  const license = path.join(path.dirname(executable), "LICENSE");
  if (!fs.existsSync(license) || fs.statSync(license).size < 1000) {
    throw new Error("Node.js distribution LICENSE is required before bundling this runtime");
  }
  const target = path.join(tauriDir, "node-runtime");
  fs.mkdirSync(target, { recursive: true });
  const binary = path.join(target, "node.exe");
  fs.copyFileSync(executable, binary);
  fs.copyFileSync(license, path.join(target, "LICENSE"));
  const result = execFileSync(binary, ["-v"], { encoding: "utf8", timeout: 10000 }).trim();
  if (result !== "v" + meta.version) {
    throw new Error("Staged Node.js executable failed version verification");
  }
  console.log("Bundled licensed Windows Node.js " + result + " (" +
    (fs.statSync(binary).size / 1048576).toFixed(1) + " MiB)");
  return { version: result, binary };
}
module.exports = { prepareNodeRuntime };
