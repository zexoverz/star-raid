import { describe, expect, it } from "vitest";
import { buildFrame, type RaidSnapshot } from "../src/frames.js";

const snap: RaidSnapshot = {
  raidId: 3n,
  status: 2,
  wallId: 41n,
  endBlock: 0n,
  orderPrice: 2_613_000,
  orderSize: 100_000n * 10n ** 10n,
  levelHead: 41n,
  counted: 1_600_000_000n,
  seatBuys: 4n,
  nonSeatBuys: 1n,
  bestBid: 0n,
  bestAsk: 26_130_000_000_000_000n,
};

describe("buildFrame", () => {
  it("serialises bigints and names the status and wall", () => {
    const f = buildFrame(snap, 123n, "proposed");
    expect(f).toEqual({
      raidId: "3",
      block: "123",
      state: "proposed",
      status: "Open",
      wall: "active",
      wallRemaining: "1000000000000000",
      counted: "1600000000",
      seatBuys: "4",
      nonSeatBuys: "1",
      bestBid: "0",
      bestAsk: "26130000000000000",
      endBlock: "0",
    });
    expect(() => JSON.stringify(f)).not.toThrow();
  });

  it("reports a filled wall as zero remaining", () => {
    const f = buildFrame({ ...snap, levelHead: 42n }, 124n, "finalized");
    expect(f.wall).toBe("filled");
    expect(f.wallRemaining).toBe("0");
    expect(f.state).toBe("finalized");
  });
});
