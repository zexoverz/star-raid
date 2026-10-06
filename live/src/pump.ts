import { buildFrame, type FrameState } from "./frames.js";
import type { Hub } from "./hub.js";
import type { Reader } from "./reader.js";
import type { BuyLog, SeatLog } from "./events.js";

export interface Logs {
  sync(head: bigint, finalized: bigint): Promise<void>;
  backfill?(raid: { raidId: bigint; w0: bigint; w1: bigint; settled: boolean }): Promise<void>;
  forRaid(raidId: bigint, block: bigint): { buys: BuyLog[]; seats: SeatLog[] };
}

/**
 * Turns block numbers into frames. Proposed heads come from the head subscription; finalized numbers
 * from a separate poll. Reads are serialised so a slow read never overlaps the next one; a head that
 * arrives mid-read is coalesced into the newest one, and a finalized read is never dropped for it.
 */
export class Pump {
  private busy = false;
  // One coalescing slot per state, so a slow RPC cannot starve either kind of frame: finalized reads
  // used to win every time and proposed frames never went out on public testnet.
  private pendingProposed: bigint | null = null;
  private pendingFinalized: bigint | null = null;
  private lastServed: FrameState = "finalized";
  lastProposed = 0n;
  lastFinalized = 0n;
  errors = 0;

  constructor(
    private reader: Reader & { retire?(raidId: bigint): void },
    private logs: Logs,
    private hub: Hub,
    private log: (msg: string) => void = () => {},
  ) {}

  onHead(block: bigint) {
    if (block <= this.lastProposed) return;
    this.lastProposed = block;
    this.pendingProposed = block;
    void this.drain();
  }

  onFinalized(block: bigint) {
    if (block <= this.lastFinalized) return;
    this.lastFinalized = block;
    this.pendingFinalized = block;
    void this.drain();
  }

  private next(): { block: bigint; state: FrameState } | null {
    // a head at or below the finalized block adds nothing
    if (this.pendingProposed !== null && this.pendingProposed <= this.lastFinalized) this.pendingProposed = null;
    // when both wait, serve the one that did not go last, so neither starves on a slow RPC
    const takeProposed =
      this.pendingProposed !== null && (this.pendingFinalized === null || this.lastServed === "finalized");
    if (takeProposed) {
      const block = this.pendingProposed!;
      this.pendingProposed = null;
      this.lastServed = "proposed";
      return { block, state: "proposed" };
    }
    if (this.pendingFinalized !== null) {
      const block = this.pendingFinalized;
      this.pendingFinalized = null;
      this.lastServed = "finalized";
      return { block, state: "finalized" };
    }
    return null;
  }

  private async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (let job = this.next(); job; job = this.next()) {
        const { block, state } = job;
        try {
          const head = this.lastProposed > block ? this.lastProposed : block;
          await this.logs.sync(head, this.lastFinalized);
          const snaps = await this.reader.readAt(block);
          for (const s of snaps) {
            await this.logs.backfill?.({ raidId: s.raidId, w0: s.w0, w1: s.w1, settled: s.status === 5 });
            this.hub.publish(buildFrame(s, this.logs.forRaid(s.raidId, block), block, state));
            if (state === "finalized") this.reader.retire?.(s.raidId);
          }
        } catch (e) {
          this.errors++;
          this.log(`read at ${block} (${state}) failed: ${(e as Error).message.split("\n")[0]}`);
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
