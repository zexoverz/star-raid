import { describe, expect, it } from "vitest";
import { wallRemaining, wallStatus } from "../src/wall.js";

describe("wall status from the level head (rule 4)", () => {
  it("active while the head is at or before the wall", () => {
    expect(wallStatus(10n, 2_613_000, 10n)).toBe("active");
    expect(wallStatus(10n, 2_613_000, 7n)).toBe("active");
    expect(wallRemaining(10n, 2_613_000, 500n, 10n)).toBe(500n);
  });

  it("cancelled when the order is deleted (price 0)", () => {
    expect(wallStatus(10n, 0, 0n)).toBe("cancelled");
    expect(wallRemaining(10n, 0, 0n, 0n)).toBe(0n);
  });

  it("filled when the head moved past it, even with the old size kept", () => {
    expect(wallStatus(10n, 2_613_000, 11n)).toBe("filled");
    expect(wallRemaining(10n, 2_613_000, 1_000_000n, 11n)).toBe(0n);
  });

  it("filled when the level is empty", () => {
    expect(wallStatus(10n, 2_613_000, 0n)).toBe("filled");
    expect(wallRemaining(10n, 2_613_000, 1_000_000n, 0n)).toBe(0n);
  });
});
