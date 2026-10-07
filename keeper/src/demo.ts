// Testnet only: post a demo raid every DEMO_EVERY_MIN minutes when none is in flight, so the app always
// has a live raid to build against. The keeper is the sponsor of its demo raids; the test tokens are
// mintable by anyone, so it mints its own wall and bounty.
import { encodeFunctionData, type Address } from "viem";
import { erc20Abi, vaultAbi } from "./abi.js";
import { GAS } from "./gas.js";
import { Status, type RaidState } from "./decide.js";
import type { Signer, Tx } from "./signer.js";

export const DEMO = {
  wallSize: 100_000n * 10n ** 10n, // 100k tSTAR in Kuru size units
  wallWei: 100_000n * 10n ** 18n,
  bounty: 50_000_000n, // 50 tUSDC
  target: 500_000_000n, // 500 tUSDC of wall fill
  seatCap: 600_000_000n,
  price: 2_600_000n, // 0.026 tUSDC at price precision 1e8
  lead: 60n, // blocks from posting to w0, about 25 s
  window: BigInt(process.env.DEMO_WINDOW_BLOCKS ?? 150), // 150 blocks is about a minute; the vault allows 40 to 400
  hold: 60,
} as const;

const IN_FLIGHT = new Set<number>([Status.Posted, Status.Open, Status.Closing, Status.Closed]);

/** Why a demo raid cannot be posted right now, or null if it can. */
export function demoBlocker(raids: RaidState[]): string | null {
  if (raids.some((r) => IN_FLIGHT.has(r.status))) return "a raid is already running";
  // An unswept wall from the last raid is a cheaper ask in front of the next wall: every buy would
  // fill it first and count for nothing (D39). Wait for recoverWall.
  if (raids.some((r) => r.status === Status.Settled && !r.wallRecovered)) return "the last raid's wall is still being swept";
  return null;
}

/** Scheduled demo: post when nothing blocks it and the last demo is at least `everyMs` old. */
export function shouldPostDemo(raids: RaidState[], nowMs: number, lastMs: number, everyMs: number): boolean {
  return demoBlocker(raids) === null && nowMs - lastMs >= everyMs;
}

export const ON_DEMAND = {
  cooldownMs: 60_000, // between two requested raids
  minBalance: 600_000_000_000_000_000n, // 0.6 MON: one raid costs the keeper about 0.35
} as const;

/** A raid asked for from the app: same blockers, plus a cooldown and a balance floor (the endpoint is public). */
export function onDemandBlocker(raids: RaidState[], nowMs: number, lastMs: number, balance: bigint): string | null {
  const blocked = demoBlocker(raids);
  if (blocked) return blocked;
  const wait = ON_DEMAND.cooldownMs - (nowMs - lastMs);
  if (wait > 0) return `the last raid was just posted, try again in ${Math.ceil(wait / 1000)} s`;
  if (balance < ON_DEMAND.minBalance) return "the keeper is low on testnet MON";
  return null;
}

export function demoTxs(d: { vault: Address; market: Address; baseToken: Address; quoteToken: Address }, me: Address, head: bigint): Tx[] {
  const w0 = head + DEMO.lead;
  const terms = {
    market: d.market, prizeToken: d.quoteToken, wallSize: DEMO.wallSize, bounty: DEMO.bounty, target: DEMO.target,
    seatCap: DEMO.seatCap, w0, w1: w0 + DEMO.window, hold: DEMO.hold, capBps: 0, anchorMode: 0, anchorParam: DEMO.price,
  };
  const call = (abi: readonly unknown[], functionName: string, args: unknown[]) =>
    encodeFunctionData({ abi, functionName, args } as never);
  return [
    { to: d.baseToken, data: call(erc20Abi, "mint", [me, DEMO.wallWei]), gas: GAS.mint },
    { to: d.quoteToken, data: call(erc20Abi, "mint", [me, DEMO.bounty]), gas: GAS.mint },
    { to: d.baseToken, data: call(erc20Abi, "approve", [d.vault, DEMO.wallWei]), gas: GAS.approve },
    { to: d.quoteToken, data: call(erc20Abi, "approve", [d.vault, DEMO.bounty]), gas: GAS.approve },
    { to: d.vault, data: call(vaultAbi, "post", [terms, []]), gas: GAS.post },
  ];
}

export async function postDemo(signer: Signer, txs: Tx[]): Promise<void> {
  for (const tx of txs) {
    const r = await signer.send(tx);
    if (!r.ok) throw new Error(`demo step reverted ${r.hash}`);
  }
}
