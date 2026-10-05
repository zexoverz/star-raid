import type { RaidSnapshot } from "../src/frames.js";
import type { BuyLog, SeatLog } from "../src/events.js";

export const SEAT_A = `0x${"a".repeat(64)}` as const;
export const SEAT_B = `0x${"b".repeat(64)}` as const;
export const NONE = `0x${"0".repeat(64)}` as const;
export const ALICE = "0x000000000000000000000000000000000000A11c" as const;
export const BOB = "0x0000000000000000000000000000000000000B0b" as const;
export const CAROL = "0x00000000000000000000000000000000000Ca401" as const;
const Z = "0x0000000000000000000000000000000000000000" as const;

export function snap(over: Partial<RaidSnapshot> = {}): RaidSnapshot {
  return {
    raidId: 1n, status: 2, sponsor: Z, market: Z, base: Z, quote: Z, prizeToken: Z,
    baseDecimals: 18, quoteDecimals: 6, pricePrecision: 100_000_000n, sizePrecision: 10_000_000_000n,
    wallSize: 1_000_000_000_000_000n, capPrice: 2_600_000n, bounty: 50_000_000n, target: 500_000_000n,
    seatCap: 600_000_000n, w0: 1000n, w1: 1120n, hold: 60n, settledAt: 0n, endBlock: 0n, won: false,
    wallId: 9n, orderPrice: 2_600_000, orderSize: 769_230_769_230_770n, levelHead: 9n, lastSold: 230_769_230_769_230n,
    counted: 600_000_000n, seatBuys: 2n, nonSeatBuys: 1n, ...over,
  };
}

export function buy(id: string, block: bigint, seatKey: `0x${string}`, player: `0x${string}`, wallFill: bigint, counted: bigint): BuyLog {
  return { id, raidId: 1n, block, tx: `0x${id.padStart(64, "0")}`, player, seatKey, baseOut: 1n, quoteSpent: wallFill + 5n, wallFillQuote: wallFill, countedAdded: counted };
}

export const seats: SeatLog[] = [
  { raidId: 1n, block: 1001n, seatKey: SEAT_A, player: ALICE, kind: 1, holder: ALICE, tokenId: 42n },
  { raidId: 1n, block: 1002n, seatKey: SEAT_B, player: BOB, kind: 2, holder: Z, tokenId: 0n },
];
