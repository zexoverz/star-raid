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
  window: 150n, // about a minute
  hold: 60,
} as const;

const IN_FLIGHT = new Set<number>([Status.Posted, Status.Open, Status.Closing, Status.Closed]);

/** Post when nothing is in flight and the last demo is at least `everyMs` old. */
export function shouldPostDemo(raids: RaidState[], nowMs: number, lastMs: number, everyMs: number): boolean {
  if (raids.some((r) => IN_FLIGHT.has(r.status))) return false;
  return nowMs - lastMs >= everyMs;
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
