import { describe, expect, it } from "vitest";
import { EventStore } from "../src/events.js";

const R = "0x00000000000000000000000000000000000000Aa" as const;
const G = "0x00000000000000000000000000000000000000Bb" as const;

function raided(block: bigint, tx: string) {
  return {
    eventName: "Raided", blockNumber: block, transactionHash: `0x${tx.padStart(64, "0")}`, logIndex: 0,
    args: { raidId: 1n, player: R, seatKey: `0x${"a".repeat(64)}`, blockNumber: block, baseOut: 1n, quoteSpent: 2n, wallFillQuote: 2n, countedAdded: 2n },
  };
}

describe("event store", () => {
  it("keeps finalized logs and re-reads the tentative tail, so a reorged buy drops out", async () => {
    let chain = [raided(101n, "1"), raided(104n, "2")];
    const calls: Array<[bigint, bigint]> = [];
    const client = {
      getLogs: async (q: { fromBlock: bigint; toBlock: bigint }) => {
        calls.push([q.fromBlock, q.toBlock]);
        return chain.filter((l) => l.blockNumber >= q.fromBlock && l.blockNumber <= q.toBlock);
      },
    };
    const s = new EventStore(client as never, R, G, R, 100n);
    await s.sync(105n, 102n);
    expect(s.forRaid(1n, 105n).buys.map((b) => b.block)).toEqual([101n, 104n]);

    chain = [raided(101n, "1")]; // block 104 reorged away
    await s.sync(106n, 103n);
    expect(s.forRaid(1n, 106n).buys.map((b) => b.block)).toEqual([101n]);
    expect(s.forRaid(1n, 100n).buys).toHaveLength(0);
  });

  it("reads in chunks of at most 100 blocks", async () => {
    const calls: Array<[bigint, bigint]> = [];
    const client = { getLogs: async (q: { fromBlock: bigint; toBlock: bigint }) => (calls.push([q.fromBlock, q.toBlock]), []) };
    await new EventStore(client as never, R, G, R, 1n).sync(250n, 250n);
    expect(calls).toEqual([[1n, 100n], [101n, 200n], [201n, 250n]]);
  });
});
