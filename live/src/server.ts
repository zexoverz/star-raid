import { createServer, type Server, type ServerResponse } from "node:http";
import type { Hub } from "./hub.js";

const HEARTBEAT_MS = 15_000;

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

function json(res: ServerResponse, code: number, body: unknown) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** GET /health, GET /raids/:id, GET /raids/:id/stream. Serves cached frames only. */
export function startServer(hub: Hub, port: number, health: () => unknown): Server {
  const server = createServer((req, res) => {
    if (req.method === "OPTIONS") {
      cors(res);
      res.writeHead(204).end();
      return;
    }
    if (req.method !== "GET" || !req.url) return json(res, 405, { error: "GET only" });
    const path = new URL(req.url, "http://x").pathname;
    if (path === "/health") return json(res, 200, health());

    const m = path.match(/^\/raids\/(\d+)(\/stream)?$/);
    if (!m) return json(res, 404, { error: "not found" });
    const raidId = m[1]!;
    if (!m[2]) return json(res, 200, hub.latest(raidId));

    cors(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n"); // flush headers so clients and proxies open the stream now
    const send = (f: unknown) => res.write(`event: frame\ndata: ${JSON.stringify(f)}\n\n`);
    const { proposed, finalized } = hub.latest(raidId);
    if (finalized) send(finalized);
    if (proposed) send(proposed);
    const off = hub.subscribe(raidId, send);
    const beat = setInterval(() => res.write(": hb\n\n"), HEARTBEAT_MS);
    req.on("close", () => {
      clearInterval(beat);
      off();
    });
  });
  server.listen(port);
  return server;
}
