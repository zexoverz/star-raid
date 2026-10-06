import type { Address, Hex } from "viem";
import { STATUS, type StatusName } from "./abi.js";
import { wallRemaining, wallStatus, type WallStatus } from "./wall.js";
import { NO_SEAT, type BuyLog, type SeatLog, type SettledLog } from "./events.js";

export type FrameState = "proposed" | "finalized";

/** Everything the reader learns about one raid at one block. */
export interface RaidSnapshot {
  raidId: bigint;
  status: number;
  sponsor: Address;
  market: Address;
  base: Address;
  quote: Address;
  prizeToken: Address;
  baseDecimals: number;
  quoteDecimals: number;
  pricePrecision: bigint;
  sizePrecision: bigint;
  wallSize: bigint; // Kuru size units
  capPrice: bigint; // Kuru price units, 0 until Open
  bounty: bigint;
  target: bigint;
  seatCap: bigint;
  w0: bigint;
  w1: bigint;
  hold: bigint;
  settledAt: bigint;
  endBlock: bigint; // 0 until drawn
  won: boolean;
  wallId: bigint; // 0 until Open
  orderPrice: number;
  orderSize: bigint;
  levelHead: bigint;
  lastSold: bigint; // size units sold at the last read that saw the wall active or filled
  counted: bigint;
  seatBuys: bigint;
  nonSeatBuys: bigint;
}

// ---------------------------------------------------------------- the wire format (v1)

/** All amounts are decimal strings of integer token units (wei-like), never floats. */
export interface FrameTerms {
  sponsor: Address;
  market: Address;
  base: Address;
  quote: Address;
  prizeToken: Address; // the bounty token
  baseDecimals: number;
  quoteDecimals: number;
  wallSize: string; // base token units
  capPrice: string | null; // quote token units per one whole base token; null before Open
  bounty: string; // prize token units
  target: string; // quote token units of counted wall fill needed to win
  seatCap: string; // quote token units one seat can count
  w0: string; // first block buys are accepted
  w1: string; // last block buys are accepted
  drawFrom: string; // the end block E will be drawn uniformly in [drawFrom, w1]
  hold: number; // seconds after settle before a winning seat can claim
}

export interface FrameBuy {
  id: string; // `${txHash}:${logIndex}`, unique and stable; dedupe the feed on it
  tx: Hex;
  block: string;
  player: Address;
  seatKey: Hex | null; // null: a buy with no seat, accepted and never counted
  kind: number | null; // 1 Lil Stars holder, 2 personhood, null without a seat
  holder: Address | null; // the Stars holder the seat belongs to (kind 1)
  tokenId: string | null; // the Star that opened the seat, for the avatar (kind 1)
  baseOut: string; // base token units the buyer received (from every ask under the cap)
  quoteSpent: string; // quote token units spent
  wallFillQuote: string; // the part of quoteSpent that bought from the sponsor's wall
  countedAdded: string; // what the buy added to the seat's counted total, after the seat cap
  afterEnd: boolean | null; // null until E is drawn; true means the buy is after E and does not count
}

export interface FrameSeat {
  seatKey: Hex;
  kind: number;
  player: Address;
  holder: Address | null;
  tokenId: string | null;
  buys: number;
  wallFillQuote: string; // all its wall fill, before the cap and the end block
  counted: string; // its counted total: buys at or before E (all buys while E is unknown), capped
}

export interface Frame {
  v: 1;
  raidId: string;
  block: string; // the block every value below was read at
  state: FrameState;
  status: StatusName;
  terms: FrameTerms;
  wall: WallStatus | "none"; // none before Open
  wallRemaining: string; // base token units still resting on the book (0 once filled or cancelled)
  wallSold: string; // base token units the wall sold to buyers (kept correct after the wall is cancelled)
  counted: string; // quote token units counted toward the target (the router's own total)
  endBlock: string | null; // E, null until drawn
  won: boolean | null; // null until settled
  settledAt?: number | null; // unix seconds of settle, null before; a winning seat can claim at settledAt + terms.hold
  seatBuys: string;
  nonSeatBuys: string; // buys from wallets with no seat: they went through and count for nothing
  totals: { quoteSpent: string; wallFillQuote: string }; // over every buy; wall share = wallFillQuote / quoteSpent
  buys: FrameBuy[]; // oldest first
  seats: FrameSeat[]; // most counted first
}

// ---------------------------------------------------------------- builder

const toBase = (size: bigint, s: RaidSnapshot) => (size * 10n ** BigInt(s.baseDecimals)) / s.sizePrecision;

export function buildFrame(
  s: RaidSnapshot,
  logs: { buys: BuyLog[]; seats: SeatLog[]; settled?: SettledLog },
  block: bigint,
  state: FrameState,
): Frame {
  const seatInfo = new Map(logs.seats.map((x) => [x.seatKey, x]));
  const hasEnd = s.endBlock > 0n;
  const open = s.wallId !== 0n;
  const remaining = open ? wallRemaining(s.wallId, s.orderPrice, s.orderSize, s.levelHead) : s.wallSize;
  const wall = open ? wallStatus(s.wallId, s.orderPrice, s.levelHead) : "none";
  // A cancelled wall (swept at settle, or by Kuru's admin) has nothing left on the book, which says
  // nothing about what it sold: take settle's own figure, or the last reading while it was live.
  const sold = wall === "cancelled" ? (logs.settled?.wallSold ?? s.lastSold) : s.wallSize - remaining;

  const buys: FrameBuy[] = [...logs.buys]
    .sort((a, b) => (a.block === b.block ? a.id.localeCompare(b.id) : a.block < b.block ? -1 : 1))
    .map((b) => {
      const seated = b.seatKey !== NO_SEAT;
      const seat = seated ? seatInfo.get(b.seatKey) : undefined;
      return {
        id: b.id,
        tx: b.tx,
        block: b.block.toString(),
        player: b.player,
        seatKey: seated ? b.seatKey : null,
        kind: seat ? seat.kind : null,
        holder: seat && seat.kind === 1 ? seat.holder : null,
        tokenId: seat && seat.kind === 1 ? seat.tokenId.toString() : null,
        baseOut: b.baseOut.toString(),
        quoteSpent: b.quoteSpent.toString(),
        wallFillQuote: b.wallFillQuote.toString(),
        countedAdded: b.countedAdded.toString(),
        afterEnd: hasEnd ? b.block > s.endBlock : null,
      };
    });

  const seatAgg = new Map<Hex, { buys: number; fill: bigint; counted: bigint }>();
  let quoteSpent = 0n;
  let wallFill = 0n;
  for (const b of logs.buys) {
    quoteSpent += b.quoteSpent;
    wallFill += b.wallFillQuote;
    if (b.seatKey === NO_SEAT) continue;
    const a = seatAgg.get(b.seatKey) ?? { buys: 0, fill: 0n, counted: 0n };
    a.buys++;
    a.fill += b.wallFillQuote;
    if (!hasEnd || b.block <= s.endBlock) a.counted += b.countedAdded;
    seatAgg.set(b.seatKey, a);
  }
  const seats: FrameSeat[] = [...seatAgg.entries()]
    .map(([key, a]) => {
      const info = seatInfo.get(key);
      return {
        seatKey: key,
        kind: info?.kind ?? 0,
        player: info?.player ?? ("0x0000000000000000000000000000000000000000" as Address),
        holder: info && info.kind === 1 ? info.holder : null,
        tokenId: info && info.kind === 1 ? info.tokenId.toString() : null,
        buys: a.buys,
        wallFillQuote: a.fill.toString(),
        counted: a.counted.toString(),
      };
    })
    .sort((x, y) => (BigInt(y.counted) > BigInt(x.counted) ? 1 : BigInt(y.counted) < BigInt(x.counted) ? -1 : 0));

  const quarter = (s.w1 - s.w0) / 4n;
  return {
    v: 1,
    raidId: s.raidId.toString(),
    block: block.toString(),
    state,
    status: STATUS[s.status] ?? "None",
    terms: {
      sponsor: s.sponsor,
      market: s.market,
      base: s.base,
      quote: s.quote,
      prizeToken: s.prizeToken,
      baseDecimals: s.baseDecimals,
      quoteDecimals: s.quoteDecimals,
      wallSize: toBase(s.wallSize, s).toString(),
      capPrice: s.capPrice === 0n ? null : ((s.capPrice * 10n ** BigInt(s.quoteDecimals)) / s.pricePrecision).toString(),
      bounty: s.bounty.toString(),
      target: s.target.toString(),
      seatCap: s.seatCap.toString(),
      w0: s.w0.toString(),
      w1: s.w1.toString(),
      drawFrom: (s.w1 - quarter).toString(),
      hold: Number(s.hold),
    },
    wall,
    wallRemaining: toBase(remaining, s).toString(),
    wallSold: toBase(sold, s).toString(),
    counted: s.counted.toString(),
    endBlock: hasEnd ? s.endBlock.toString() : null,
    won: s.status === 5 ? s.won : null,
    settledAt: s.status === 5 ? Number(s.settledAt) : null,
    seatBuys: s.seatBuys.toString(),
    nonSeatBuys: s.nonSeatBuys.toString(),
    totals: { quoteSpent: quoteSpent.toString(), wallFillQuote: wallFill.toString() },
    buys,
    seats,
  };
}
