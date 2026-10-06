import type { Frame } from "./frames.js";

type Listener = (frame: Frame) => void;

/** Last frames per raid and the viewers listening to each. Viewers only ever read from here. */
export class Hub {
  private last = new Map<string, { proposed?: Frame; finalized?: Frame }>();
  private listeners = new Map<string, Set<Listener>>();

  publish(frame: Frame) {
    const slot = this.last.get(frame.raidId) ?? {};
    slot[frame.state] = frame;
    this.last.set(frame.raidId, slot);
    for (const l of this.listeners.get(frame.raidId) ?? []) l(frame);
  }

  /** Every raid the service has seen, newest first: the finalized frame without its buy and seat lists. */
  list() {
    return [...this.last.entries()]
      .map(([, slot]) => slot.finalized ?? slot.proposed!)
      .filter(Boolean)
      .sort((a, b) => Number(BigInt(b.raidId) - BigInt(a.raidId)))
      .map(({ buys, seats, ...summary }) => ({ ...summary, buyCount: buys.length, seatCount: seats.length }));
  }

  latest(raidId: string) {
    return this.last.get(raidId) ?? {};
  }

  subscribe(raidId: string, l: Listener): () => void {
    let set = this.listeners.get(raidId);
    if (!set) this.listeners.set(raidId, (set = new Set()));
    set.add(l);
    return () => set!.delete(l);
  }

  viewers(raidId: string) {
    return this.listeners.get(raidId)?.size ?? 0;
  }
}
