/**
 * T-Line adapter for the canonical SuperAgent Brain storage module.
 * The core implementation is generated into this repo by
 * superagent/scripts/sync-brain-runtime.ts. Keep this file focused on
 * local-cli session resolution, never MCP OAuth identity impersonation.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const getRootConfigDir = (): string =>
  path.resolve(process.env.SUPERAGENT_CONFIG_DIR?.trim() || path.join(os.homedir(), ".superagent-r"));

const sessionIdValid = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
function ownerHash(owner: string) {
  if (!owner || owner.length > 2048) throw new Error("Invalid Brain owner.");
  return crypto.createHash("sha256").update(owner).digest("hex").slice(0,24);
}
export function inspectBrainSession(owner: string, id: string, configRoot = getRootConfigDir()) {
  if (!sessionIdValid.test(id)) throw new Error("Invalid Brain session.");
  const directory = path.join(configRoot, "brain", ownerHash(owner), id);
  const manifest = path.join(directory,"manifest.json");
  if (fs.lstatSync(directory).isSymbolicLink() || fs.lstatSync(manifest).isSymbolicLink()) throw new Error("Brain symlink.");
  const parsed = JSON.parse(fs.readFileSync(manifest,"utf8"));
  if (parsed.schemaVersion !== 1 || parsed.sessionId !== id || parsed.ownerHash !== ownerHash(owner)) {
    throw new Error("Foreign Brain manifest.");
  }
  return { path: directory, sessionId: id };
}
export function listBrainFiles(owner: string, sessionId: string, configRoot = getRootConfigDir()) {
  const dir = inspectBrainSession(owner, sessionId, configRoot).path;
  const files: Array<{path: string; bytes: number}> = [];
  const walk = (folder: string, depth: number) => {
    if (depth > 8 || files.length >= 250 || !fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
      if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile()) files.push({path:path.relative(dir,full).replace(/\\/g,"/"),bytes:fs.statSync(full).size});
    }
  };
  for (const a of ["scratch","artifacts","evidence"]) walk(path.join(dir,a),0);
  return files;
}
export function listBrainSessions(owner: string, configRoot = getRootConfigDir()) {
  const directory = path.join(configRoot, "brain", ownerHash(owner));
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes:true }).filter(x=>x.isDirectory() && sessionIdValid.test(x.name)).slice(0,100);
  return entries.flatMap(entry=>{
    try { const session = inspectBrainSession(owner,entry.name,configRoot); return [{sessionId:session.sessionId}]; }
    catch { return []; }
  });
}
