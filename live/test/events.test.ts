import { describe, expect, it } from "vitest";
import { EventStore } from "../src/events.js";

const R = "0x00000000000000000000000000000000000000Aa" as const;
const G = "0x00000000000000000000000000000000000000Bb" as const;

function raided(block: bigint, tx: string, raidId = 1n) {
  return {
    eventName: "Raided", blockNumber: block, transactionHash: `0x${tx.padStart(64, "0")}`, logIndex: 0,
    args: { raidId, player: R, seatKey: `0x${"a".repeat(64)}`, blockNumber: block, baseOut: 1n, quoteSpent: 2n, wallFillQuote: 2n, countedAdded: 2n },
  };
}
const settled = (block: bigint, raidId = 1n) => ({
  eventName: "Settled", blockNumber: block, transactionHash: `0x${"5".padStart(64, "0")}`, logIndex: 1, args: { raidId, won: true, countedTotal: 2n, wallSold: 40n },
});

function chainOf(logs: () => Array<{ blockNumber: bigint }>) {
  const calls: Array<[bigint, bigint]> = [];
  const client = {
    getLogs: async (q: { fromBlock: bigint; toBlock: bigint }) => {
      calls.push([q.fromBlock, q.toBlock]);
      return logs().filter((l) => l.blockNumber >= q.fromBlock && l.blockNumber <= q.toBlock);
    },
  };
  return { client, calls };
}

describe("event store", () => {
  it("follows live logs and re-reads the tentative tail, so a reorged buy drops out", async () => {
    let chain = [raided(101n, "1"), raided(104n, "2")];
    const { client } = chainOf(() => chain);
    const s = new EventStore(client as never, R, G, R);
    await s.sync(100n, 100n); // service starts at 100
    await s.sync(105n, 102n);
    expect(s.forRaid(1n, 105n).buys.map((b) => b.block)).toEqual([101n, 104n]);

    chain = [raided(101n, "1")]; // block 104 reorged away
    await s.sync(106n, 103n);
    expect(s.forRaid(1n, 106n).buys.map((b) => b.block)).toEqual([101n]);
    expect(s.forRaid(1n, 100n).buys).toHaveLength(0);
  });

  it("starts without scanning the chain since deploy", async () => {
    const { client, calls } = chainOf(() => []);
    await new EventStore(client as never, R, G, R).sync(1_000_000n, 999_998n);
    expect(calls).toEqual([[999_999n, 1_000_000n]]); // only the tentative tail
  });

  it("reads an old raid's history inside its own window and stops at its Settled log", async () => {
    const { client, calls } = chainOf(() => [raided(5_010n, "1"), raided(5_090n, "2"), settled(5_160n), raided(9_000n, "9", 2n)]);
    const s = new EventStore(client as never, R, G, R);
    await s.sync(1_000_000n, 1_000_000n);
    calls.length = 0;
    await s.backfill({ raidId: 1n, w0: 5_000n, w1: 5_150n, settled: true });
    expect(calls).toEqual([[5_000n, 5_099n], [5_100n, 5_150n], [5_151n, 5_250n]]);
    const got = s.forRaid(1n, 1_000_000n);
    expect(got.buys.map((b) => b.block)).toEqual([5_010n, 5_090n]);
    expect(got.settled?.wallSold).toBe(40n);
    await s.backfill({ raidId: 1n, w0: 5_000n, w1: 5_150n, settled: true });
    expect(calls).toHaveLength(3); // once per raid
  });

  it("does not double count a raid that was live when the service started", async () => {
    const { client } = chainOf(() => [raided(990n, "1"), raided(1_005n, "2")]);
    const s = new EventStore(client as never, R, G, R);
    await s.sync(1_000n, 1_000n);
    await s.backfill({ raidId: 1n, w0: 980n, w1: 1_100n, settled: false });
    await s.sync(1_010n, 1_008n);
    expect(s.forRaid(1n, 1_010n).buys.map((b) => b.block)).toEqual([990n, 1_005n]);
  });
});
