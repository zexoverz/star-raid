import { buildFrame, type FrameState } from "./frames.js";
import type { Hub } from "./hub.js";
import type { Reader } from "./reader.js";

/**
 * Turns block numbers into frames. Proposed heads come from the head subscription; finalized numbers
 * from a separate poll. Reads are serialised so a slow read never overlaps the next one; a head that
 * arrives mid-read is coalesced into the newest one.
 */
export class Pump {
  private busy = false;
  private pending: { block: bigint; state: FrameState } | null = null;
  lastProposed = 0n;
  lastFinalized = 0n;
  errors = 0;

  constructor(
    private reader: Reader,
    private hub: Hub,
    private log: (msg: string) => void = () => {},
  ) {}

  onHead(block: bigint) {
    if (block <= this.lastProposed) return;
    this.lastProposed = block;
    this.enqueue(block, "proposed");
  }

  onFinalized(block: bigint) {
    if (block <= this.lastFinalized) return;
    this.lastFinalized = block;
    this.enqueue(block, "finalized");
  }

  private enqueue(block: bigint, state: FrameState) {
    // finalized frames are never dropped in favour of a proposed one
    if (!this.pending || state === "finalized" || this.pending.state === "proposed") this.pending = { block, state };
    void this.drain();
  }

  private async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.pending) {
        const { block, state } = this.pending;
        this.pending = null;
        try {
          const snaps = await this.reader.readAt(block);
          for (const s of snaps) this.hub.publish(buildFrame(s, block, state));
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
