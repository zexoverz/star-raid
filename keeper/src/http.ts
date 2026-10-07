// Testnet only: lets the app ask for a raid now instead of waiting for the schedule.
//   GET  /demo   { canStart, reason, keeperMon }
//   POST /demo   202 { queued: true } or 409 { reason }
// The request only sets a flag; the keeper loop posts the raid, so sends stay in one place and in order.
import { createServer, type Server } from "node:http";

export type DemoGate = {
  blocker: () => string | null; // why a raid cannot start right now
  request: () => void;
  keeperMon: () => string;
};

export function startDemoServer(port: number, gate: DemoGate): Server {
  return createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    const send = (code: number, body: unknown) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (path === "/health") return send(200, { ok: true });
    if (path !== "/demo") return send(404, { error: "not found" });
    const reason = gate.blocker();
    if (req.method === "GET") return send(200, { canStart: reason === null, reason, keeperMon: gate.keeperMon() });
    if (req.method !== "POST") return send(405, { error: "GET or POST" });
    if (reason) return send(409, { reason });
    gate.request();
    send(202, { queued: true });
  }).listen(port);
}
