import raw26 from './data/raid-26.json'
import raw3 from './data/raid-3.json'

/**
 * Every number in the video comes from a real settled testnet raid, snapshotted from the live
 * service (`GET /raids/:id`, finalized frame). AGENTS rule 13: never state a number the chain does
 * not show. Re-snapshot with `pnpm snapshot`.
 */
type Buy = { block: string; baseOut: string; tokenId: string | null; seatKey: string | null; countedAdded: string; quoteSpent: string; wallFillQuote: string; afterEnd: boolean | null }
type Frame = {
  raidId: string
  wallSold: string
  counted: string
  endBlock: string
  won: boolean
  nonSeatBuys: string
  totals: { quoteSpent: string; wallFillQuote: string }
  terms: { wallSize: string; bounty: string; target: string; seatCap: string; w0: string; w1: string; drawFrom: string; hold: number; baseDecimals: number; quoteDecimals: number }
  buys: Buy[]
  seats: { tokenId: string | null; counted: string; buys: number }[]
}

const units = (v: string, d: number) => Number(BigInt(v)) / 10 ** d

function digest(f: Frame) {
  const t = f.terms
  const q = (v: string) => units(v, t.quoteDecimals)
  const buys = [...f.buys].sort((a, b) => Number(a.block) - Number(b.block))
  return {
    id: f.raidId,
    won: f.won,
    w0: Number(t.w0),
    w1: Number(t.w1),
    drawFrom: Number(t.drawFrom),
    endBlock: Number(f.endBlock),
    hold: t.hold,
    target: q(t.target),
    bounty: q(t.bounty),
    seatCap: q(t.seatCap),
    counted: q(f.counted),
    wallSize: units(t.wallSize, t.baseDecimals),
    wallSold: units(f.wallSold, t.baseDecimals),
    wallShare: Number(BigInt(f.totals.wallFillQuote) * 10_000n / BigInt(f.totals.quoteSpent)) / 10_000,
    nonSeatBuys: Number(f.nonSeatBuys),
    countedHits: buys.filter((b) => b.seatKey && b.afterEnd === false).length,
    lateHits: buys.filter((b) => b.afterEnd).length,
    seats: f.seats.map((s) => ({ tokenId: s.tokenId, counted: q(s.counted), buys: s.buys })),
    buys: buys.map((b) => ({ block: Number(b.block), tokenId: b.tokenId, seated: !!b.seatKey, counted: q(b.countedAdded), base: units(b.baseOut, t.baseDecimals), spent: q(b.quoteSpent), afterEnd: !!b.afterEnd })),
  }
}

export type Raid = ReturnType<typeof digest>

/** The headline raid: 58 hits from one seat broke the target. */
export const RAID = digest((raw26 as unknown as { finalized: Frame }).finalized)
/** A raid with a no-seat buy that went through and counted for nothing. */
export const RAID_NO_SEAT = digest((raw3 as unknown as { finalized: Frame }).finalized)

export const fmt = (n: number, frac = 2) =>
  n >= 10_000 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : n.toLocaleString('en-US', { maximumFractionDigits: frac })
