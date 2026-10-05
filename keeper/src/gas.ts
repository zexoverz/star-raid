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

// Player buy: 800k plus 40k per extra maker order it may cross (AGENTS.md rule 10).
export function raidGasLimit(extraMakers: number): bigint {
  if (!Number.isInteger(extraMakers) || extraMakers < 0) throw new Error("extraMakers must be a whole number");
  return 800_000n + 40_000n * BigInt(extraMakers);
}
