// Monad bills the gas limit, not the gas used (rule 10), so every send carries an explicit limit.
// Limits are the measured maxima from `forge test --gas-report` times about 1.5, rounded up.
export const GAS = {
  open: 900_000n, // measured max 566k
  close: 500_000n, // 120k with the mock; the real Entropy request costs more
  closeWithoutEntropy: 100_000n, // 38k
  settle: 700_000n, // 331k plus a Kuru cancel and two withdrawals
  recoverWall: 450_000n, // 180k
  expire: 300_000n, // 136k
  post: 600_000n, // 356k
  approve: 80_000n,
  mint: 120_000n,
} as const;

export const RAID_GAS_CEILING = 2_000_000n;

// Player buy: at least 800k plus 40k per extra maker order it may cross (AGENTS.md rule 10), raised to
// the estimate at latest x 1.5 when that is higher (SPEC §16 M8), never above the ceiling. A first buy
// on a cold seat measured 864k on the testnet market.
export function raidGasLimit(extraMakers: number, estimate?: bigint): bigint {
  if (!Number.isInteger(extraMakers) || extraMakers < 0) throw new Error("extraMakers must be a whole number");
  const floor = 800_000n + 40_000n * BigInt(extraMakers);
  if (estimate === undefined) return floor;
  const padded = (estimate * 3n) / 2n;
  const limit = padded > floor ? padded : floor;
  return limit > RAID_GAS_CEILING ? RAID_GAS_CEILING : limit;
}
