// Start guard (SPEC §2.4, §10): refuse to open if the mid ranged over 20 bps in the last 60 s, trades
// spanned over 50 bps in the last 5 min, or the last trade is older than 300 blocks.

export const GUARD = {
  midRangeBps: 20,
  tradeSpanBps: 50,
  maxTradeAgeBlocks: 300n,
  midWindowBlocks: 150n, // ~60 s at 400 ms
  tradeWindowBlocks: 750n, // ~5 min
} as const;

export type GuardInput = {
  mids: bigint[]; // book mids sampled over the last 60 s, any unit
  tradePrices: bigint[]; // trade prices over the last 5 min
  lastTradeBlock: bigint | null;
  head: bigint;
};

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function rangeBps(xs: bigint[]): number {
  if (xs.length === 0) return 0;
  let lo = xs[0];
  let hi = xs[0];
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  if (lo === 0n) return Number.POSITIVE_INFINITY;
  return Number(((hi - lo) * 10_000n) / lo);
}

export function startGuard(g: GuardInput): GuardResult {
  if (g.mids.length === 0) return { ok: false, reason: "no mid in the last 60 s" };
  const mr = rangeBps(g.mids);
  if (mr > GUARD.midRangeBps) return { ok: false, reason: `mid ranged ${mr} bps in 60 s` };
  const ts = rangeBps(g.tradePrices);
  if (ts > GUARD.tradeSpanBps) return { ok: false, reason: `trades spanned ${ts} bps in 5 min` };
  if (g.lastTradeBlock === null || g.head - g.lastTradeBlock > GUARD.maxTradeAgeBlocks) {
    return { ok: false, reason: "no trade in the last 300 blocks" };
  }
  return { ok: true };
}
