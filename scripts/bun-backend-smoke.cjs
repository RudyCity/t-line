"use strict";
/** Production Bun backend smoke: isolated home, temporary port, no SuperAgent spawn. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

if (!process.versions.bun) throw new Error("Start backend smoke with Bun");
const runtime = process.env.TLINE_BUN_RUNTIME || process.execPath;
const project = path.resolve(__dirname, "..");
const installedRoot = process.env.TLINE_BACKEND_SMOKE_ROOT || null;
const backendDir = installedRoot
  ? path.join(installedRoot, "backend")
  : path.join(project, "desktop-tauri", "backend");
const backend = path.join(backendDir, "dist", "server.js");
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
    cwd: backendDir,
    env: { ...process.env, PORT: String(port), TLINE_BIND_HOST: "127.0.0.1",
      TLINE_SKIP_SUPERAGENT_AUTOSTART: "1",
      TLINE_BUN_RUNTIME: runtime, HOME: sandbox, USERPROFILE: sandbox },
    stdout: "pipe", stderr: "pipe"
  });
  let response;
  let lastConnectError;
  let stdoutText = "";
  let stderrText = "";
  const drain = async (stream, which) => {
    try {
      for await (const block of stream) {
        const chunk = new TextDecoder().decode(block);
        if (which === "stdout") stdoutText = (stdoutText + chunk).slice(-16000);
        else stderrText = (stderrText + chunk).slice(-16000);
      }
    } catch { /* the isolated child was already terminated */ }
  };
  void drain(server.stdout, "stdout");
  void drain(server.stderr, "stderr");
  try {
    // A freshly extracted ~82 MB Bun binary may have a substantial first-start
    // Windows Defender scan. Probe for a bounded 20s rather than guessing at 6s.
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) break;
      try {
        response = await fetch("http://127.0.0.1:" + port + "/api/workspaces",
          { signal: AbortSignal.timeout(650) });
        break;
      } catch (error) { lastConnectError = error; await Bun.sleep(120); }
    }
    // Missing credentials must be rejected by the packaged privileged API.
    if (!response || response.status !== 401) {
      const code = await Promise.race([server.exited, Bun.sleep(200).then(() => "still-running")]);
      throw new Error("Bun backend failed its HTTP readiness probe (exit=" + code +
        ", status=" + (response?.status ?? "none") + ", lastConnectError=" + String(lastConnectError ?? "none") + ")" +
        " stdout=" + stdoutText.slice(-950) + " stderr=" + stderrText.slice(-950));
    }
    console.log("BUN_BACKEND_SMOKE_OK", "http=" + response.status, "runtime=" + process.versions.bun);
  } finally {
    try { server.kill(); } catch {}
    await Promise.race([server.exited, Bun.sleep(2200)]);
    fs.rmSync(sandbox, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  }
})().catch(error => { console.error("BUN_BACKEND_SMOKE_FAILED", error.stack); process.exitCode = 1; });
