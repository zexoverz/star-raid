import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { shouldPostDemo, onDemandBlocker, ON_DEMAND, demoTxs, DEMO } from "../src/demo.js";
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
  it("waits for the last raid's wall to be swept (it would sit in front of the new wall)", () => {
    expect(shouldPostDemo([{ ...r(Status.Settled), wallRecovered: false }], 10_000, 0, 1)).toBe(false);
  });
  it("starts a requested raid at once when nothing blocks it", () => {
    expect(onDemandBlocker([r(Status.Settled)], 1_000_000, 0, 10n ** 18n)).toBeNull();
    expect(onDemandBlocker([], 1_000_000, 0, 10n ** 18n)).toBeNull();
  });
  it("refuses a requested raid while one runs, inside the cooldown, or when the keeper is nearly dry", () => {
    expect(onDemandBlocker([r(Status.Open)], 1_000_000, 0, 10n ** 18n)).toBe("a raid is already running");
    expect(onDemandBlocker([{ ...r(Status.Settled), wallRecovered: false }], 1_000_000, 0, 10n ** 18n)).toMatch(/swept/);
    expect(onDemandBlocker([], 1_000_000, 1_000_000 - 10_000, 10n ** 18n)).toMatch(/try again in 50 s/);
    expect(onDemandBlocker([], 1_000_000, 0, ON_DEMAND.minBalance - 1n)).toMatch(/low on testnet MON/);
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
