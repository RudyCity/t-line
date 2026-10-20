/** Strictly scoped fixed-path proxy for explicit new-instruction task retry. */
import http from "node:http";
import { getSuperAgentServiceHeaders } from "./superAgentAuth";

const JOB = /^clj_\d{8,17}_[a-f0-9]{8}$/;
const SESSION = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
export type RetryRequest = {
  workspace: string; sessionId: string; jobId: string;
  prompt?: string; challenge?: string;
};
export function validRetryRequest(stage: "prepare" | "confirm", data: RetryRequest): boolean {
  return typeof data.workspace === "string" && data.workspace.length > 0 &&
    data.workspace.length <= 4096 && !/[\u0000-\u001f]/.test(data.workspace) &&
    typeof data.sessionId === "string" && SESSION.test(data.sessionId) &&
    typeof data.jobId === "string" && JOB.test(data.jobId) &&
    (stage === "prepare"
      ? typeof data.prompt === "string" && data.prompt.trim().length >= 20 &&
        data.prompt.length <= 4000 && !data.prompt.includes("\0") && data.challenge === undefined
      : typeof data.challenge === "string" && /^[0-9a-f]{48}$/.test(data.challenge) &&
        data.prompt === undefined);
}
export function forwardTlineRetry(
  stage: "prepare" | "confirm", data: RetryRequest,
  opts: { port?: number; headers?: Record<string, string> } = {},
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (!validRetryRequest(stage, data)) {
    return Promise.resolve({ status: 400, payload: { success: false, error: "Invalid retry request." } });
  }
  const headers = opts.headers ?? getSuperAgentServiceHeaders();
  if (!headers.Authorization) return Promise.resolve({ status: 503,
    payload: { success: false, error: "SuperAgent service token unavailable." } });
  const body = JSON.stringify(data);
  return new Promise(resolve => {
    let done = false;
    const finish = (status: number, payload: Record<string, unknown>) => {
      if (done) return;
      done = true;
      resolve({ status, payload });
    };
    const req = http.request({
      hostname: "127.0.0.1", port: opts.port ?? 7888,
      path: "/api/tline/tasks/retry/" + stage, method: "POST", timeout: 8000,
      headers: { ...headers, "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body), "x-workspace-path": data.workspace,
        "x-client-mode": "tline" },
    }, response => {
      let text = "";
      response.on("data", (part: Buffer) => {
        text += String(part);
        if (text.length > 8192) req.destroy(new Error("Oversized retry response"));
      });
      response.on("end", () => {
        try {
          const payload = JSON.parse(text);
          if (!payload || Array.isArray(payload) || typeof payload !== "object") throw Error("Bad response");
          finish(response.statusCode || 502, payload);
        } catch { finish(502, { success: false, error: "Invalid retry service response." }); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Retry request timeout.")));
    req.on("error", () => finish(503, { success: false,
      error: "Retry service unavailable or outcome uncertain. Check task status before another attempt." }));
    req.end(body);
  });
}
