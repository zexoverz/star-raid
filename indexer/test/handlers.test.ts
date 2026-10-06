import { describe, it } from "vitest";
import { createTestIndexer } from "envio";

type Hex = `0x${string}`;

const CHAIN = 10143;
// simulated blocks sit after the configured start_block (the testnet deploy block)
const B = 68_548_970;
const MARKET: Hex = "0x00000000000000000000000000000000000000Aa";
const MAKER: Hex = "0x00000000000000000000000000000000000000Bb";
const STRANGER: Hex = "0x00000000000000000000000000000000000000Cc";
const SPONSOR: Hex = "0x00000000000000000000000000000000000000Dd";
const ALICE: Hex = "0x000000000000000000000000000000000000A11c";
const BOB: Hex = "0x0000000000000000000000000000000000000B0b";
const KEY_A: Hex = `0x${"a".repeat(64)}`;
const KEY_B: Hex = `0x${"b".repeat(64)}`;
const NO_SEAT: Hex = `0x${"0".repeat(64)}`;

const terms = {
  market: MARKET,
  prizeToken: SPONSOR,
  wallSize: 1_000n,
  bounty: 50n,
  target: 500n,
  seatCap: 300n,
  w0: 100n,
  w1: 200n,
  hold: 60n,
  capBps: 0n,
  anchorMode: 0n,
  anchorParam: 2_600_000n,
};

const raided = (player: Hex, seatKey: Hex, block: number, countedAdded: bigint) => ({
  contract: "RaidRouter" as const,
  event: "Raided" as const,
  block: { number: block },
  params: {
    raidId: 1n,
    player,
    seatKey,
    blockNumber: BigInt(block),
    baseOut: 10n,
    quoteSpent: countedAdded,
    wallFillQuote: countedAdded,
    countedAdded,
  },
});

const bound = (player: Hex, seatKey: Hex, block: number) => ({
  contract: "SeatGate" as const,
  event: "SeatBound" as const,
  block: { number: block },
  params: { raidId: 1n, seatKey, player, kind: 1n, holder: player, tokenId: 7n },
});

async function run() {
  const indexer = createTestIndexer();
  await indexer.process({
    chains: {
      [CHAIN]: {
        simulate: [
          { contract: "RaidVault", event: "Posted", block: { number: B + 90 }, params: { raidId: 1n, sponsor: SPONSOR, market: MARKET, terms, fromRollover: 0n } },
          { contract: "RaidVault", event: "Opened", block: { number: B + 100 }, params: { raidId: 1n, capPrice: 2_600_000n, wallId: 7n, maker: MAKER, anchor: 2_600_000n, mid: 0n } },
          bound(ALICE, KEY_A, B + 120),
          raided(ALICE, KEY_A, B + 120, 100n),
          { contract: "KuruOrderBook", event: "Trade", srcAddress: MARKET, block: { number: B + 120 }, params: { orderId: 7n, makerAddress: MAKER, isBuy: false, price: 26n, updatedSize: 900n, takerAddress: ALICE, txOrigin: ALICE, filledSize: 100n } },
          { contract: "KuruOrderBook", event: "Trade", srcAddress: MARKET, block: { number: B + 121 }, params: { orderId: 9n, makerAddress: STRANGER, isBuy: false, price: 25n, updatedSize: 0n, takerAddress: ALICE, txOrigin: ALICE, filledSize: 400n } },
          raided(STRANGER, NO_SEAT, B + 130, 0n),
          bound(BOB, KEY_B, B + 190),
          raided(BOB, KEY_B, B + 190, 200n), // after E: counted provisionally, not at the end
          raided(ALICE, KEY_A, B + 195, 50n), // after E as well
          { contract: "RaidVault", event: "CloseRequested", block: { number: B + 201 }, params: { raidId: 1n, sequence: 1n, fee: 1n } },
          { contract: "RaidVault", event: "EndDrawn", block: { number: B + 203 }, params: { raidId: 1n, endBlock: BigInt(B + 180), randomNumber: `0x${"1".repeat(64)}` } },
          { contract: "RaidVault", event: "Settled", block: { number: B + 204 }, params: { raidId: 1n, won: false, countedTotal: 100n, wallSold: 100n } },
        ],
      },
    },
  });
  return indexer;
}

describe("handlers", () => {
  it("Raided creates a Buy and updates the Seat and Player", async (t) => {
    const ix = await run();
    const seat = await ix.Seat.getOrThrow(`1-${KEY_A}`);
    t.expect(seat.buys).toBe(2);
    t.expect(seat.counted).toBe(150n);
    t.expect(seat.baseBought).toBe(20n);
    const alice = await ix.Player.getOrThrow(ALICE.toLowerCase());
    t.expect(alice.buys).toBe(2);
    t.expect(alice.raidsJoined).toBe(1);
    const buy = await ix.Buy.getOrThrow(`${CHAIN}-${B + 120}-3`);
    t.expect(buy.countedAdded).toBe(100n);
    t.expect(buy.hasSeat).toBe(true);
  });

  it("counts only buys at or before E once it is drawn", async (t) => {
    const ix = await run();
    t.expect((await ix.Seat.getOrThrow(`1-${KEY_A}`)).countedAtEnd).toBe(100n);
    t.expect((await ix.Seat.getOrThrow(`1-${KEY_B}`)).countedAtEnd).toBe(0n);
    t.expect((await ix.Player.getOrThrow(ALICE.toLowerCase())).counted).toBe(100n);
    t.expect((await ix.Player.getOrThrow(BOB.toLowerCase())).counted).toBe(0n);
    t.expect((await ix.PlayerRaid.getOrThrow(`1-${BOB.toLowerCase()}`)).counted).toBe(200n);
  });

  it("indexes only Trades whose maker is our wall", async (t) => {
    const ix = await run();
    const raid = await ix.Raid.getOrThrow("1");
    t.expect(raid.wallFilled).toBe(100n);
    t.expect(await ix.WallFill.get(`${CHAIN}-${B + 121}-5`)).toBeUndefined();
    t.expect((await ix.WallFill.getOrThrow(`${CHAIN}-${B + 120}-4`)).filledSize).toBe(100n);
  });

  it("Settled marks the raid with what settle counted", async (t) => {
    const ix = await run();
    const raid = await ix.Raid.getOrThrow("1");
    t.expect(raid.status).toBe("Settled");
    t.expect(raid.won).toBe(false);
    t.expect(raid.countedTotal).toBe(100n);
    t.expect(raid.countedProvisional).toBe(350n);
    t.expect(raid.endBlock).toBe(BigInt(B + 180));
    t.expect(raid.seatBuys).toBe(3);
    t.expect(raid.nonSeatBuys).toBe(1);
    t.expect(raid.seats).toBe(2);
  });
});
