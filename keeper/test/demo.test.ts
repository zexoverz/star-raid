import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { shouldPostDemo, demoTxs, DEMO } from "../src/demo.js";
import { Status, type RaidState } from "../src/decide.js";
import { vaultAbi } from "../src/abi.js";

const r = (status: number): RaidState => ({ id: 1n, status, w0: 0n, w1: 0n, requestBlock: 0n, wallRecovered: true });
const A = "0x00000000000000000000000000000000000000aa" as const;

describe("demo raids", () => {
  it("never posts while a raid is in flight", () => {
    for (const s of [Status.Posted, Status.Open, Status.Closing, Status.Closed]) {
      expect(shouldPostDemo([r(s)], 10_000, 0, 1)).toBe(false);
    }
  });
  it("posts after the interval once everything has settled or aborted", () => {
    expect(shouldPostDemo([r(Status.Settled), r(Status.Aborted)], 10_000, 0, 5_000)).toBe(true);
    expect(shouldPostDemo([r(Status.Settled)], 10_000, 6_000, 5_000)).toBe(false);
    expect(shouldPostDemo([], 1, 0, 1)).toBe(true);
  });
  it("posts terms the vault accepts, with explicit gas on every step", () => {
    const txs = demoTxs({ vault: A, market: A, baseToken: A, quoteToken: A }, A, 1000n);
    expect(txs.every((t) => t.gas > 0n)).toBe(true);
    const post = decodeFunctionData({ abi: vaultAbi, data: txs[4].data });
    const t = (post.args as unknown as readonly [{ w0: bigint; w1: bigint; bounty: bigint; target: bigint }])[0];
    expect(t.w0).toBe(1000n + DEMO.lead);
    expect(t.w1 - t.w0).toBe(DEMO.window);
    expect(t.target).toBeGreaterThanOrEqual(t.bounty * 10n); // the vault's 10x rule
  });
});
