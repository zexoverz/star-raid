import { encodeFunctionData, type Address, type PublicClient } from "viem";
import { vaultAbi, entropyAbi, bookAbi, tradeEvent } from "./abi.js";
import type { RaidState } from "./decide.js";
import type { Tx } from "./signer.js";
import { GAS } from "./gas.js";
import type { Action } from "./decide.js";
import type { GuardInput } from "./guard.js";
import { GUARD } from "./guard.js";

/// Every read that decides an action happens at the finalized block (rule 12).
export class ChainReader {
  constructor(private client: PublicClient, private vault: Address) {}

  async finalizedBlock(): Promise<bigint> {
    const b = await this.client.getBlock({ blockTag: "finalized" });
    return b.number;
  }

  async raids(at: bigint): Promise<(RaidState & { market: Address })[]> {
    const count = await this.client.readContract({ address: this.vault, abi: vaultAbi, functionName: "raidCount", blockNumber: at });
    const out: (RaidState & { market: Address })[] = [];
    for (let id = 1n; id <= count; id++) {
      const r = await this.client.readContract({ address: this.vault, abi: vaultAbi, functionName: "raid", args: [id], blockNumber: at });
      out.push({
        id,
        status: r.status,
        w0: r.terms.w0,
        w1: r.terms.w1,
        requestBlock: r.requestBlock,
        wallRecovered: r.wallRecovered,
        market: r.terms.market,
      });
    }
    return out;
  }

  async entropyFee(at: bigint): Promise<bigint> {
    const entropy = await this.client.readContract({ address: this.vault, abi: vaultAbi, functionName: "entropy", blockNumber: at });
    return this.client.readContract({ address: entropy, abi: entropyAbi, functionName: "getFeeV2", blockNumber: at });
  }

  /// Guard inputs from the book and Trade logs, in 100-block chunks (public RPC getLogs cap).
  async guardInput(market: Address, head: bigint): Promise<GuardInput> {
    const mids: bigint[] = [];
    for (let b = head - GUARD.midWindowBlocks; b <= head; b += 15n) {
      const [bid, ask] = await this.client.readContract({ address: market, abi: bookAbi, functionName: "bestBidAsk", blockNumber: b });
      if (bid > 0n && ask > 0n && bid !== 2n ** 256n - 1n) mids.push((bid + ask) / 2n);
    }
    const tradePrices: bigint[] = [];
    let lastTradeBlock: bigint | null = null;
    for (let from = head - GUARD.tradeWindowBlocks; from <= head; from += 100n) {
      const to = from + 99n > head ? head : from + 99n;
      const logs = await this.client.getLogs({ address: market, event: tradeEvent, fromBlock: from, toBlock: to });
      for (const l of logs) {
        tradePrices.push(l.args.price!);
        if (lastTradeBlock === null || l.blockNumber > lastTradeBlock) lastTradeBlock = l.blockNumber;
      }
    }
    return { mids, tradePrices, lastTradeBlock, head };
  }
}

export function buildTx(vault: Address, action: Action, id: bigint, entropyFee = 0n): Tx {
  const data = encodeFunctionData({ abi: vaultAbi, functionName: action, args: [id] });
  return { to: vault, data, gas: GAS[action], value: action === "close" ? entropyFee : undefined };
}
