import { describe, expect, it } from "vitest";
import { startGuard, rangeBps } from "../src/guard.js";

const calm = { mids: [10_000n, 10_010n], tradePrices: [10_000n, 10_040n], lastTradeBlock: 990n, head: 1000n };

describe("start guard", () => {
  it("measures range in bps", () => {
    expect(rangeBps([10_000n, 10_020n])).toBe(20);
    expect(rangeBps([])).toBe(0);
  });
  it("passes a calm, live market", () => {
    expect(startGuard(calm)).toEqual({ ok: true });
  });
  it("refuses a mid that moved over 20 bps in 60 s", () => {
    expect(startGuard({ ...calm, mids: [10_000n, 10_021n] }).ok).toBe(false);
  });
  it("refuses trades spanning over 50 bps in 5 min", () => {
    expect(startGuard({ ...calm, tradePrices: [10_000n, 10_051n] }).ok).toBe(false);
  });
  it("refuses a dark market (the 23 h outage case)", () => {
    expect(startGuard({ ...calm, lastTradeBlock: 699n }).ok).toBe(false);
    expect(startGuard({ ...calm, lastTradeBlock: null }).ok).toBe(false);
  });
  it("refuses with no mid at all", () => {
    expect(startGuard({ ...calm, mids: [] }).ok).toBe(false);
  });
});
