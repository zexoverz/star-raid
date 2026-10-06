import { describe, expect, it } from "vitest";
import { buildFrame } from "../src/frames.js";
import { snap, buy, seats, SEAT_A, SEAT_B, NONE, ALICE, BOB, CAROL } from "./fixture.js";

const logs = {
  seats,
  buys: [
    buy("1", 1001n, SEAT_A, ALICE, 300_000_000n, 300_000_000n),
    buy("2", 1010n, NONE, CAROL, 0n, 0n),
    buy("3", 1100n, SEAT_B, BOB, 200_000_000n, 200_000_000n),
    buy("4", 1115n, SEAT_A, ALICE, 100_000_000n, 100_000_000n),
  ],
};

describe("frame v1", () => {
  it("carries terms in token units and the draw range", () => {
    const f = buildFrame(snap(), logs, 1050n, "proposed");
    expect(f.v).toBe(1);
    expect(f.terms.wallSize).toBe("100000000000000000000000"); // 100k tokens, 18 decimals
    expect(f.terms.capPrice).toBe("26000"); // 0.026 in 6-decimal quote units
    expect(f.terms.drawFrom).toBe("1090");
    expect(f.terms.w1).toBe("1120");
    expect(f.status).toBe("Open");
    expect(f.endBlock).toBeNull();
    expect(f.won).toBeNull();
  });

  it("reads the wall through the head, never the size (rule 4)", () => {
    const filled = buildFrame(snap({ levelHead: 10n }), logs, 1050n, "finalized");
    expect(filled.wall).toBe("filled");
    expect(filled.wallRemaining).toBe("0");
    expect(filled.wallSold).toBe(filled.terms.wallSize);
    expect(buildFrame(snap({ wallId: 0n }), logs, 1050n, "proposed").wall).toBe("none");
  });

  it("counts nothing before E is drawn as final, then cuts at E", () => {
    const before = buildFrame(snap(), logs, 1116n, "proposed");
    expect(before.buys.every((b) => b.afterEnd === null)).toBe(true);
    expect(before.seats.find((s) => s.seatKey === SEAT_A)!.counted).toBe("400000000");

    const after = buildFrame(snap({ endBlock: 1105n, status: 4 }), logs, 1130n, "finalized");
    expect(after.endBlock).toBe("1105");
    expect(after.buys.map((b) => b.afterEnd)).toEqual([false, false, false, true]);
    const a = after.seats.find((s) => s.seatKey === SEAT_A)!;
    expect(a.counted).toBe("300000000"); // the buy at 1115 is after E
    expect(a.wallFillQuote).toBe("400000000");
    expect(after.seats[0].seatKey).toBe(SEAT_A); // most counted first
  });

  it("marks seatless buys and carries the Star for avatars", () => {
    const f = buildFrame(snap(), logs, 1116n, "proposed");
    const carol = f.buys.find((b) => b.player === CAROL)!;
    expect(carol.seatKey).toBeNull();
    expect(carol.kind).toBeNull();
    const alice = f.buys.find((b) => b.player === ALICE)!;
    expect(alice.tokenId).toBe("42");
    expect(alice.holder).toBe(ALICE);
    expect(f.buys.find((b) => b.player === BOB)!.tokenId).toBeNull(); // personhood seat, no Star
    expect(f.nonSeatBuys).toBe("1");
    expect(f.totals.wallFillQuote).toBe("600000000");
    expect(f.totals.quoteSpent).toBe("600000020");
  });

  it("keeps what a cancelled wall sold: settle's figure, else the last live reading", () => {
    const swept = buildFrame(snap({ orderPrice: 0, status: 5 }), { ...logs, settled: { raidId: 1n, block: 1130n, wallSold: 400_000_000_000_000n } }, 1200n, "finalized");
    expect(swept.wall).toBe("cancelled");
    expect(swept.wallRemaining).toBe("0");
    expect(swept.wallSold).toBe("40000000000000000000000"); // 40k of the 100k wall, not all of it
    const adminCancelled = buildFrame(snap({ orderPrice: 0 }), logs, 1050n, "proposed");
    expect(adminCancelled.wallSold).toBe("23076923076923000000000");
  });

  it("reports the outcome only once settled", () => {
    const done = buildFrame(snap({ status: 5, won: true, endBlock: 1105n, settledAt: 1_790_000_000n }), logs, 1200n, "finalized");
    expect(done.won).toBe(true);
    expect(done.settledAt).toBe(1_790_000_000);
    expect(buildFrame(snap({ status: 4, won: false }), logs, 1200n, "finalized").won).toBeNull();
  });

  it("carries no market price (rule 13)", () => {
    const f = buildFrame(snap(), logs, 1050n, "proposed") as unknown as Record<string, unknown>;
    expect(Object.keys(f)).not.toContain("bestBid");
    expect(Object.keys(f)).not.toContain("bestAsk");
  });
});
