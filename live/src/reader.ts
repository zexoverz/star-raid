import type { Address, PublicClient } from "viem";
import { bookAbi, LIVE_STATUSES, routerAbi, vaultAbi } from "./abi.js";
import type { RaidSnapshot } from "./frames.js";

/** Reads every live raid at one block. The only thing that talks to the RPC. */
export interface Reader {
  readAt(block: bigint): Promise<RaidSnapshot[]>;
}

interface Known {
  id: bigint;
  status: number;
  market: Address;
  wallId: bigint;
  capPrice: number;
  endBlock: bigint;
}

type Call = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };

/**
 * One multicall per block: raidCount, the view of every raid already known, and the wall, book and
 * counting reads of the raids that were live at the previous read. Raids discovered in this read
 * get their detail reads from the next block on.
 */
export class MulticallReader implements Reader {
  private known = new Map<bigint, Known>();

  constructor(
    private client: Pick<PublicClient, "multicall">,
    private vault: Address,
    private router: Address,
  ) {}

  async readAt(block: bigint): Promise<RaidSnapshot[]> {
    const ids = [...this.known.keys()];
    const live = [...this.known.values()].filter((k) => LIVE_STATUSES.has(k.status) && k.wallId !== 0n);

    const calls: Call[] = [{ address: this.vault, abi: vaultAbi, functionName: "raidCount" }];
    for (const id of ids) calls.push({ address: this.vault, abi: vaultAbi, functionName: "raidView", args: [id] });
    for (const k of live) {
      calls.push(
        { address: k.market, abi: bookAbi, functionName: "s_orders", args: [Number(k.wallId)] },
        { address: k.market, abi: bookAbi, functionName: "s_sellPricePoints", args: [BigInt(k.capPrice)] },
        { address: k.market, abi: bookAbi, functionName: "bestBidAsk" },
        { address: this.router, abi: routerAbi, functionName: "countedTotalAt", args: [k.id, block] },
        { address: this.router, abi: routerAbi, functionName: "seatBuys", args: [k.id] },
        { address: this.router, abi: routerAbi, functionName: "nonSeatBuys", args: [k.id] },
      );
    }

    const res = (await this.client.multicall({
      contracts: calls as never,
      blockNumber: block,
      allowFailure: false,
    })) as unknown[];

    let i = 0;
    const count = res[i++] as bigint;
    for (const id of ids) this.remember(id, res[i++] as RaidViewOut);

    const out: RaidSnapshot[] = [];
    for (const k of live) {
      const order = res[i++] as readonly [Address, bigint, number, number, number, number, number, boolean];
      const level = res[i++] as readonly [number, number];
      const [bid, ask] = res[i++] as readonly [bigint, bigint];
      const counted = res[i++] as bigint;
      const seatBuys = res[i++] as bigint;
      const nonSeatBuys = res[i++] as bigint;
      const now = this.known.get(k.id)!;
      out.push({
        raidId: k.id,
        status: now.status,
        wallId: k.wallId,
        endBlock: now.endBlock,
        orderPrice: Number(order[5]),
        orderSize: order[1],
        levelHead: BigInt(level[0]),
        counted,
        seatBuys,
        nonSeatBuys,
        bestBid: bid,
        bestAsk: ask,
      });
    }

    // learn raids posted since the last read; their views arrive with the next read
    for (let id = BigInt(ids.length) + 1n; id <= count; id++) {
      if (!this.known.has(id)) this.known.set(id, { id, status: 0, market: this.vault, wallId: 0n, capPrice: 0, endBlock: 0n });
    }
    return out;
  }

  private remember(id: bigint, v: RaidViewOut) {
    this.known.set(id, {
      id,
      status: Number(v.status),
      market: v.market,
      wallId: BigInt(v.wallId),
      capPrice: Number(v.capPrice),
      endBlock: v.endBlock,
    });
  }
}

interface RaidViewOut {
  status: number;
  market: Address;
  wallId: number;
  capPrice: number;
  endBlock: bigint;
}
