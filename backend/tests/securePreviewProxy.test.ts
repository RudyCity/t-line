import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import { previewProxy } from "../src/previewProxy";

let upstream: Server;
let gateway: Server;
let upstreamAddress = "";
let gatewayAddress = "";
let socketServer: WebSocketServer;
async function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}
beforeAll(async () => {
  upstream = createServer((req, res) => {
    if (req.url === "/page") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": "session=testing; Secure; Domain=localhost; Path=/" });
      res.end("<html><head><title>Preview Upstream</title></head><body>Preview works</body></html>");
      return;
    }
    if (req.url === "/huge") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html>" + "x".repeat(5 * 1024 * 1024) + "</html>");
      return;
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "/done", "Content-Type": "text/plain" });
      res.end("Moved");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ url: req.url, origin: req.headers.origin ?? null }));
  });
  socketServer = new WebSocketServer({ noServer: true });
  socketServer.on("connection", socket => {
    socket.on("message", message => { socket.send("echo:" + message.toString()); });
  });
  upstream.on("upgrade", (request, socket, head) => {
    socketServer.handleUpgrade(request, socket, head, ws => socketServer.emit("connection", ws, request));
  });
  upstreamAddress = "http://127.0.0.1:" + await listen(upstream);
  const app = express();
  app.use("/api/preview-proxy", previewProxy);
  gateway = createServer(app);
  gateway.on("upgrade", (req, socket, head) => previewProxy.upgrade(req, socket, head));
  gatewayAddress = "http://127.0.0.1:" + await listen(gateway);
});
afterAll(async () => {
  socketServer.clients.forEach(ws => ws.terminate());
  await new Promise<void>(resolve => gateway.close(() => resolve()));
  await new Promise<void>(resolve => upstream.close(() => resolve()));
  socketServer.close();
});
describe("Secure HTTP/WS preview proxy migration", () => {
  it("retains authenticated-style browser document injection and safely rewrites cookies", async () => {
    const response = await fetch(gatewayAddress + "/api/preview-proxy/page?target=" +
      encodeURIComponent(upstreamAddress) + "&tabId=preview-1", {
      headers: { accept: "text/html" },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Preview Upstream");
    expect(html).toContain("/api/preview-proxy/tline-helper.js");
    expect(html).toContain("__TLINE_PROXY_TARGET__");
    const cookies = response.headers.get("set-cookie") || "";
    expect(cookies).toContain("session=testing");
    expect(cookies).not.toMatch(/domain=localhost/i);
  });
  it("preserves query forwarding without leaking internal tab ID and target to upstream", async () => {
    const response = await fetch(gatewayAddress + "/api/preview-proxy/data?foo=bar&target=" +
      encodeURIComponent(upstreamAddress) + "&tabId=preview-1");
    expect(response.status).toBe(200);
    const payload = await response.json() as { url: string };
    expect(payload.url).toBe("/data?foo=bar");
  });
  it("rewrites relative redirect locations back into the scoped preview URL", async () => {
    const response = await fetch(gatewayAddress + "/api/preview-proxy/redirect?target=" +
      encodeURIComponent(upstreamAddress) + "&tabId=preview-1", {
      redirect: "manual", headers: { accept: "text/html" },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/api/preview-proxy/done?target=");
  });
  it("bounds HTML response memory instead of buffering arbitrary upstream content", async () => {
    const response = await fetch(gatewayAddress + "/api/preview-proxy/huge?target=" +
      encodeURIComponent(upstreamAddress) + "&tabId=preview-1", {
      headers: { accept: "text/html" },
    });
    expect(response.status).toBe(413);
    expect(await response.text()).toContain("4 MB");
  });
  it("forwards valid websocket upgrades and HMR traffic without glob dependency", async () => {
    const address = gatewayAddress.replace("http:", "ws:") + "/api/preview-proxy/socket?tabId=preview-1";
    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(address);
      socket.once("error", reject);
      socket.once("open", () => socket.send("ping"));
      socket.once("message", value => { resolve(value.toString()); socket.close(); });
    });
    expect(message).toBe("echo:ping");
  });
  it("ignores invalid target URLs and never forwards unsafe addresses to selected upstream", async () => {
    const unsafe = [
      "javascript:alert(1)", "http://username:password@localhost:3219",
      "http://127.0.0.1:1/path", "https://example.org/<script>",
    ];
    for (const target of unsafe) {
      const response = await fetch(gatewayAddress + "/api/preview-proxy/data?target=" +
        encodeURIComponent(target) + "&tabId=preview-1");
      expect(response.status).toBe(200);
      expect((await response.json() as { url: string }).url).toBe("/data");
    }
  });
});
