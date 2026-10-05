import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { buildTx, ChainReader } from "../src/chain.js";
import { GAS, raidGasLimit } from "../src/gas.js";
import { CastSigner } from "../src/signer.js";
import { vaultAbi } from "../src/abi.js";
import type { Action } from "../src/decide.js";

const VAULT = "0x00000000000000000000000000000000000000aa" as const;

describe("rule 10: explicit gas limits", () => {
  it("every keeper action carries its own limit", () => {
    const actions: Action[] = ["open", "expire", "close", "closeWithoutEntropy", "settle", "recoverWall"];
    for (const a of actions) {
      const tx = buildTx(VAULT, a, 7n, 5n);
      expect(tx.gas).toBe(GAS[a]);
      expect(decodeFunctionData({ abi: vaultAbi, data: tx.data }).functionName).toBe(a);
    }
    expect(buildTx(VAULT, "close", 7n, 5n).value).toBe(5n);
    expect(buildTx(VAULT, "settle", 7n, 5n).value).toBeUndefined();
  });
  it("player buys are 800k plus 40k per extra maker", () => {
    expect(raidGasLimit(0)).toBe(800_000n);
    expect(raidGasLimit(3)).toBe(920_000n);
    expect(() => raidGasLimit(-1)).toThrow();
  });
  it("a buy estimate is padded 1.5x above the floor, capped at the ceiling (M8)", () => {
    expect(raidGasLimit(1, 400_000n)).toBe(840_000n);
    expect(raidGasLimit(1, 864_189n)).toBe(1_296_283n);
    expect(raidGasLimit(1, 5_000_000n)).toBe(2_000_000n);
  });
  it("the signer refuses a send without a limit", async () => {
    const s = new CastSigner(VAULT, "none", "/nonexistent", "http://127.0.0.1:1", "/bin/false");
    await expect(s.send({ to: VAULT, data: "0x", gas: 0n })).rejects.toThrow("explicit gas limit required");
  });
});

describe("rule 12: decisions read finalized state", () => {
  it("reads raids at the finalized block number", async () => {
    const seen: unknown[] = [];
    const fake = {
      getBlock: async (a: { blockTag: string }) => {
        seen.push(a.blockTag);
        return { number: 555n };
      },
      readContract: async (a: { functionName: string; blockNumber?: bigint }) => {
        seen.push(a.blockNumber);
        if (a.functionName === "raidCount") return 1n;
        return { status: 2, terms: { w0: 1n, w1: 2n, market: VAULT }, requestBlock: 0n, wallRecovered: false };
      },
    };
    const r = new ChainReader(fake as never, VAULT);
    const block = await r.finalizedBlock();
    await r.raids(block);
    expect(seen[0]).toBe("finalized");
    expect(seen.slice(1)).toEqual([555n, 555n]);
  });
});
