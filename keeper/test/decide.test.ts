import { describe, expect, it } from "vitest";
import { decide, Status, OPEN_LEAD, OPEN_GRACE, ENTROPY_TIMEOUT, type RaidState } from "../src/decide.js";

const base: RaidState = { id: 1n, status: Status.Posted, w0: 1000n, w1: 1200n, requestBlock: 0n, wallRecovered: false };
const yes = () => true;

describe("decide", () => {
  it("waits until just before w0, then opens", () => {
    expect(decide(base, base.w0 - OPEN_LEAD - 1n, yes)).toBeNull();
    expect(decide(base, base.w0 - OPEN_LEAD, yes)).toEqual({ action: "open" });
  });
  it("holds the open while the start guard refuses", () => {
    expect(decide(base, base.w0, () => false)).toEqual({ wait: "start guard refused" });
  });
  it("expires a raid nobody could open", () => {
    expect(decide(base, base.w0 + OPEN_GRACE + 1n, yes)).toEqual({ action: "expire" });
  });
  it("closes strictly after w1", () => {
    const r = { ...base, status: Status.Open };
    expect(decide(r, r.w1, yes)).toBeNull();
    expect(decide(r, r.w1 + 1n, yes)).toEqual({ action: "close" });
  });
  it("falls back to E = w1 after the Entropy timeout", () => {
    const r = { ...base, status: Status.Closing, requestBlock: 1201n };
    expect(decide(r, 1201n + ENTROPY_TIMEOUT, yes)).toBeNull();
    expect(decide(r, 1202n + ENTROPY_TIMEOUT, yes)).toEqual({ action: "closeWithoutEntropy" });
  });
  it("settles once E is drawn, then retries the wall until recovered", () => {
    expect(decide({ ...base, status: Status.Closed }, 0n, yes)).toEqual({ action: "settle" });
    expect(decide({ ...base, status: Status.Settled }, 0n, yes)).toEqual({ action: "recoverWall" });
    expect(decide({ ...base, status: Status.Settled, wallRecovered: true }, 0n, yes)).toBeNull();
    expect(decide({ ...base, status: Status.Aborted }, 0n, yes)).toBeNull();
  });
});
