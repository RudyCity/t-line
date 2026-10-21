"use strict";
/** Production Bun backend smoke: isolated home, temporary port, no SuperAgent spawn. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

if (!process.versions.bun) throw new Error("Start backend smoke with Bun");
const runtime = process.env.TLINE_BUN_RUNTIME || process.execPath;
const project = path.resolve(__dirname, "..");
const backend = path.join(project, "desktop-tauri", "backend", "dist", "server.js");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "tline-bun-backend-"));

function getPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

(async () => {
  const port = await getPort();
  const server = Bun.spawn([runtime, backend], {
    cwd: path.join(project, "desktop-tauri", "backend"),
    env: { ...process.env, PORT: String(port), TLINE_SKIP_SUPERAGENT_AUTOSTART: "1",
      TLINE_BUN_RUNTIME: runtime, HOME: sandbox, USERPROFILE: sandbox },
    stdout: "pipe", stderr: "pipe"
  });
  let response;
  try {
    for (let attempt = 0; attempt < 55; attempt++) {
      if (server.exitCode !== null) break;
      try {
        response = await fetch("http://127.0.0.1:" + port + "/api/workspaces",
          { signal: AbortSignal.timeout(650) });
        break;
      } catch { await Bun.sleep(120); }
    }
    if (!response || response.status >= 500) {
      const code = await Promise.race([server.exited, Bun.sleep(200).then(() => "still-running")]);
      throw new Error("Bun backend failed to listen (exit=" + code + ")");
    }
    console.log("BUN_BACKEND_SMOKE_OK", "http=" + response.status, "runtime=" + process.versions.bun);
  } finally {
    try { server.kill(); } catch {}
    await Promise.race([server.exited, Bun.sleep(2200)]);
    fs.rmSync(sandbox, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  }
})().catch(error => { console.error("BUN_BACKEND_SMOKE_FAILED", error.stack); process.exitCode = 1; });
