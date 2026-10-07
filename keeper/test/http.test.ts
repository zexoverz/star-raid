import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { startDemoServer } from "../src/http.js";

let server: Server | undefined;
afterEach(() => server?.close());

async function up(blocker: () => string | null) {
  let requested = 0;
  server = startDemoServer(0, { blocker, request: () => requested++, keeperMon: () => "2.40" });
  await new Promise((r) => server!.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, requested: () => requested };
}

describe("on-demand endpoint", () => {
  it("queues a raid when nothing blocks it", async () => {
    const { base, requested } = await up(() => null);
    expect(await (await fetch(`${base}/demo`)).json()).toEqual({ canStart: true, reason: null, keeperMon: "2.40" });
    const res = await fetch(`${base}/demo`, { method: "POST" });
    expect(res.status).toBe(202);
    expect(requested()).toBe(1);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
  it("answers 409 with the reason and queues nothing when blocked", async () => {
    const { base, requested } = await up(() => "a raid is already running");
    const res = await fetch(`${base}/demo`, { method: "POST" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: "a raid is already running" });
    expect(requested()).toBe(0);
  });
});
