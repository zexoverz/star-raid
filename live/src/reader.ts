import type { Address, PublicClient } from "viem";
import { bookAbi, routerAbi, vaultAbi } from "./abi.js";
import type { RaidSnapshot } from "./frames.js";

/** Reads every followed raid at one block. With the event store, the only thing that talks to the RPC. */
export interface Reader {
  readAt(block: bigint): Promise<RaidSnapshot[]>;
}

type Call = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };
type MarketParams = { pricePrecision: bigint; sizePrecision: bigint; base: Address; baseDecimals: number; quote: Address; quoteDecimals: number };
type RaidOut = {
  terms: { market: Address; prizeToken: Address; wallSize: bigint; bounty: bigint; target: bigint; seatCap: bigint; w0: bigint; w1: bigint; hold: number };
  sponsor: Address;
  status: number;
  capPrice: number;
  wallId: number;
  endBlock: bigint;
  settledAt: bigint;
  won: boolean;
  wallRecovered: boolean;
  countedTotal: bigint;
};

const ABORTED = 6;
const SETTLED = 5;

/**
 * One multicall per block: raidCount, every followed raid, and the wall and counting reads of raids
 * that have a wall. Market params are read once per market. A raid is followed until a finalized
 * read has seen it Settled or Aborted; its last frames stay cached in the hub after that.
 */
export class MulticallReader implements Reader {
  private known = new Map<bigint, RaidOut>();
  private done = new Set<bigint>();
  private markets = new Map<Address, MarketParams>();
  private count = 0n;
  private lastSold = new Map<bigint, bigint>();
  // raids whose latest read had everything (wall reads, or no wall at all); only these can retire
  private complete = new Set<bigint>();

  constructor(
    private client: Pick<PublicClient, "multicall" | "readContract">,
    private vault: Address,
    private router: Address,
  ) {}

  /** Called after a finalized frame is published, so terminal raids stop costing reads. */
  retire(raidId: bigint) {
    const r = this.known.get(raidId);
    if (!r || !this.complete.has(raidId)) return;
    // a settled raid keeps changing until its wall is swept: the wall goes from active to cancelled
    const settledAndSwept = Number(r.status) === SETTLED && (r.wallRecovered || r.wallId === 0);
    if (Number(r.status) === ABORTED || settledAndSwept) this.done.add(raidId);
  }

  async readAt(block: bigint): Promise<RaidSnapshot[]> {
    const ids: bigint[] = [];
    for (let id = 1n; id <= this.count; id++) if (!this.done.has(id)) ids.push(id);
    const walled = ids.filter((id) => (this.known.get(id)?.wallId ?? 0) !== 0);

    const calls: Call[] = [{ address: this.vault, abi: vaultAbi, functionName: "raidCount" }];
    for (const id of ids) calls.push({ address: this.vault, abi: vaultAbi, functionName: "raid", args: [id] });
    for (const id of walled) {
      const r = this.known.get(id)!;
      const e = r.endBlock > 0n && r.endBlock < block ? r.endBlock : block;
      calls.push(
        { address: r.terms.market, abi: bookAbi, functionName: "s_orders", args: [r.wallId] },
        { address: r.terms.market, abi: bookAbi, functionName: "s_sellPricePoints", args: [BigInt(r.capPrice)] },
        { address: this.router, abi: routerAbi, functionName: "countedTotalAt", args: [id, e] },
        { address: this.router, abi: routerAbi, functionName: "seatBuys", args: [id] },
        { address: this.router, abi: routerAbi, functionName: "nonSeatBuys", args: [id] },
      );
    }
    const res = (await this.client.multicall({ contracts: calls as never, blockNumber: block, allowFailure: false })) as unknown[];

    let i = 0;
    const count = res[i++] as bigint;
    const raids = new Map<bigint, RaidOut>();
    for (const id of ids) raids.set(id, res[i++] as RaidOut);
    const wallReads = new Map<bigint, { order: readonly unknown[]; head: bigint; counted: bigint; seatBuys: bigint; nonSeatBuys: bigint }>();
    for (const id of walled) {
      const order = res[i++] as readonly unknown[];
      const level = res[i++] as readonly [number, number];
      wallReads.set(id, { order, head: BigInt(level[0]), counted: res[i++] as bigint, seatBuys: res[i++] as bigint, nonSeatBuys: res[i++] as bigint });
    }

    const out: RaidSnapshot[] = [];
    for (const [id, r] of raids) {
      // a finalized read can land before the block that posted a raid the proposed reads already saw
      if (Number(r.status) === 0) continue;
      this.known.set(id, r);
      const m = await this.market(r.terms.market);
      const w = wallReads.get(id);
      if (w || r.wallId === 0) this.complete.add(id);
      else this.complete.delete(id);
      let lastSold = this.lastSold.get(id) ?? 0n;
      if (w && Number(w.order[5]) !== 0) {
        const head = w.head;
        const filled = head > BigInt(r.wallId) || head === 0n;
        lastSold = filled ? r.terms.wallSize : r.terms.wallSize - (w.order[1] as bigint);
        this.lastSold.set(id, lastSold);
      }
      out.push({
        raidId: id,
        status: Number(r.status),
        sponsor: r.sponsor,
        market: r.terms.market,
        base: m.base,
        quote: m.quote,
        prizeToken: r.terms.prizeToken,
        baseDecimals: m.baseDecimals,
        quoteDecimals: m.quoteDecimals,
        pricePrecision: m.pricePrecision,
        sizePrecision: m.sizePrecision,
        wallSize: r.terms.wallSize,
        capPrice: BigInt(r.capPrice),
        bounty: r.terms.bounty,
        target: r.terms.target,
        seatCap: r.terms.seatCap,
        w0: r.terms.w0,
        w1: r.terms.w1,
        hold: BigInt(r.terms.hold),
        settledAt: r.settledAt,
        endBlock: r.endBlock,
        won: r.won,
        // a raid that got its wall in this very read has its wall reads from the next block on
        wallId: w ? BigInt(r.wallId) : 0n,
        orderPrice: w ? Number(w.order[5]) : 0,
        orderSize: w ? (w.order[1] as bigint) : 0n,
        levelHead: w?.head ?? 0n,
        lastSold,
        counted: Number(r.status) === SETTLED ? r.countedTotal : (w?.counted ?? 0n),
        seatBuys: w?.seatBuys ?? 0n,
        nonSeatBuys: w?.nonSeatBuys ?? 0n,
      });
    }
    this.count = count;
    return out;
  }

  private async market(address: Address): Promise<MarketParams> {
    const hit = this.markets.get(address);
    if (hit) return hit;
    const p = (await this.client.readContract({ address, abi: bookAbi, functionName: "getMarketParams" })) as readonly [
      number, bigint, Address, bigint, Address, bigint, number, bigint, bigint, bigint, bigint,
    ];
    const m = { pricePrecision: BigInt(p[0]), sizePrecision: p[1], base: p[2], baseDecimals: Number(p[3]), quote: p[4], quoteDecimals: Number(p[5]) };
    this.markets.set(address, m);
    return m;
  }
}
