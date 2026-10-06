import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Hub } from "../src/hub.js";
import { Pump } from "../src/pump.js";
import type { Reader } from "../src/reader.js";
import type { RaidSnapshot } from "../src/frames.js";
import { snap } from "./fixture.js";

const noLogs = { sync: async () => {}, forRaid: () => ({ buys: [], seats: [] }) };
import { startServer } from "../src/server.js";

class FakeReader implements Reader {
  calls: bigint[] = [];
  async readAt(block: bigint): Promise<RaidSnapshot[]> {
    this.calls.push(block);
    return [snap({ counted: block })];
  }
}

const tick = () => new Promise((r) => setTimeout(r, 20));

async function openStream(port: number, frames: string[]) {
  const res = await fetch(`http://127.0.0.1:${port}/raids/1/stream`);
  const reader = res.body!.getReader();
  void (async () => {
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      for (const line of dec.decode(value).split("\n")) if (line.startsWith("data: ")) frames.push(line.slice(6));
    }
  })();
  return reader;
}

let server: Server | undefined;
afterEach(() => server?.close());

describe("fan-out", () => {
  it("reads once per block however many viewers are connected", async () => {
    const reader = new FakeReader();
    const hub = new Hub();
    const pump = new Pump(reader, noLogs, hub);
    server = startServer(hub, 0, () => ({ ok: true }));
    await new Promise((r) => server!.once("listening", r));
    const port = (server.address() as AddressInfo).port;

    const got: string[][] = [[], [], [], [], []];
    const streams = await Promise.all(got.map((g) => openStream(port, g)));
    await tick();
    expect(hub.viewers("1")).toBe(5);

    pump.onHead(100n);
    await tick();
    pump.onHead(101n);
    await tick();
    pump.onFinalized(100n);
    await tick();

    expect(reader.calls).toEqual([100n, 101n, 100n]);
    for (const g of got) {
      expect(g.map((f) => JSON.parse(f).state)).toEqual(["proposed", "proposed", "finalized"]);
    }
    const snap = await (await fetch(`http://127.0.0.1:${port}/raids/1`)).json();
    expect(snap.proposed.block).toBe("101");
    expect(snap.finalized.block).toBe("100");
    expect(reader.calls.length).toBe(3); // the JSON read hit the cache too
    for (const s of streams) await s.cancel();
  });

  it("ignores stale heads", async () => {
    const reader = new FakeReader();
    const pump = new Pump(reader, noLogs, new Hub());
    pump.onHead(10n);
    await tick();
    pump.onHead(9n);
    pump.onHead(10n);
    await tick();
    expect(reader.calls).toEqual([10n]);
  });
});

describe("reader", () => {
  it("skips a raid that does not exist yet at the read block", async () => {
    const { MulticallReader } = await import("../src/reader.js");
    let call = 0;
    const client = {
      multicall: async () => (call++ === 0 ? [1n] : [1n, { status: 0, terms: { market: "0x0000000000000000000000000000000000000000" } }]),
      readContract: async () => {
        throw new Error("must not read market params of an empty raid");
      },
    };
    const r = new MulticallReader(client as never, "0x00000000000000000000000000000000000000Aa", "0x00000000000000000000000000000000000000Bb");
    expect(await r.readAt(10n)).toEqual([]);
    expect(await r.readAt(9n)).toEqual([]);
  });
});

describe("pump on a slow RPC", () => {
  it("keeps sending proposed frames while finalized blocks keep arriving", async () => {
    const states: string[] = [];
    const hub = { publish: (f: { state: string }) => states.push(f.state) } as never;
    const slow = { readAt: async (b: bigint) => (await new Promise((r) => setTimeout(r, 30)), [snap({ counted: b })]) };
    const pump = new Pump(slow, noLogs, hub);
    // heads every 10 ms and finalized every 15 ms, both faster than one 30 ms read
    for (let i = 1n; i <= 20n; i++) {
      pump.onHead(100n + i);
      if (i % 2n === 0n) pump.onFinalized(98n + i);
      await new Promise((r) => setTimeout(r, 10));
    }
    await new Promise((r) => setTimeout(r, 200));
    expect(states.filter((s) => s === "proposed").length).toBeGreaterThan(2);
    expect(states.filter((s) => s === "finalized").length).toBeGreaterThan(2);
  });
});

describe("raid list", () => {
  it("lists every raid newest first, finalized when known, without the long lists", () => {
    const hub = new Hub();
    const f = (id: bigint, state: "proposed" | "finalized", block: bigint) =>
      ({ ...JSON.parse(JSON.stringify({ raidId: id.toString(), state, block: block.toString(), buys: [1, 2], seats: [1] })) });
    hub.publish(f(1n, "finalized", 10n));
    hub.publish(f(2n, "proposed", 12n));
    hub.publish(f(2n, "finalized", 11n));
    const l = hub.list() as Array<Record<string, unknown>>;
    expect(l.map((x) => x.raidId)).toEqual(["2", "1"]);
    expect(l[0].state).toBe("finalized");
    expect(l[0].buyCount).toBe(2);
    expect(l[0]).not.toHaveProperty("buys");
  });
});

describe("reader retirement", () => {
  it("keeps reading a settled raid until a read has included its wall", async () => {
    const { MulticallReader } = await import("../src/reader.js");
    const raid = {
      status: 5, terms: { market: "0x00000000000000000000000000000000000000Cc", prizeToken: "0x00000000000000000000000000000000000000Cc", wallSize: 100n, bounty: 1n, target: 10n, seatCap: 10n, w0: 1n, w1: 2n, hold: 0 },
      sponsor: "0x00000000000000000000000000000000000000Cc", capPrice: 100, wallId: 7, endBlock: 2n, settledAt: 1n, won: true, wallRecovered: false, countedTotal: 10n,
    };
    const client = {
      multicall: async ({ contracts }: { contracts: unknown[] }) => {
        const out: unknown[] = [1n];
        if (contracts.length > 1) out.push(raid);
        if (contracts.length > 2) out.push(["0x0", 40n, 0, 0, 0, 100, 0, false], [7, 7], 10n, 1n, 0n);
        return out;
      },
      readContract: async () => [100_000_000, 10_000_000_000n, "0x0", 18n, "0x0", 6n, 100, 1n, 2n, 0n, 0n],
    };
    const r = new MulticallReader(client as never, "0x00000000000000000000000000000000000000Aa", "0x00000000000000000000000000000000000000Bb");
    await r.readAt(10n); // learns the count
    const first = await r.readAt(11n); // raid read, no wall reads yet
    expect(first[0].wallId).toBe(0n);
    r.retire(1n);
    const second = await r.readAt(12n); // not retired: now with its wall
    expect(second).toHaveLength(1);
    expect(second[0].wallId).toBe(7n);
    r.retire(1n);
    expect(await r.readAt(13n)).toHaveLength(1); // settled but the wall is not swept yet: keep reading
    raid.wallRecovered = true;
    await r.readAt(14n);
    r.retire(1n);
    expect(await r.readAt(15n)).toHaveLength(0);
  });
});
