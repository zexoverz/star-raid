import type { Address } from "viem";
import { decide, type Action } from "./decide.js";
import { startGuard } from "./guard.js";
import { buildTx, type ChainReader } from "./chain.js";
import type { Signer } from "./signer.js";
import type { Alerter } from "./alert.js";

export const ALERT_AFTER_FAILURES = 2;

/// One pass over every raid at the current finalized block.
export class Keeper {
  private failures = new Map<string, number>();
  private lastWait = new Map<bigint, string>();
  // A sent action is in flight until the finalized block reaches its receipt; finalized state still
  // shows the old status until then, and acting on it would send the same step twice.
  private inflight = new Map<bigint, bigint>();

  constructor(
    private reader: ChainReader,
    private signer: Signer,
    private vault: Address,
    private thinMarkets: Set<string>,
    private alert: Alerter,
    private log: (s: string) => void = console.log,
  ) {}

  async tick(): Promise<{ block: bigint; acted: { id: bigint; action: Action; ok: boolean }[] }> {
    const block = await this.reader.finalizedBlock();
    const raids = await this.reader.raids(block);
    const acted: { id: bigint; action: Action; ok: boolean }[] = [];
    for (const r of raids) {
      const until = this.inflight.get(r.id);
      if (until !== undefined && block < until) continue;
      this.inflight.delete(r.id);
      let guardOk = true;
      if (r.status === 1 && !this.thinMarkets.has(r.market.toLowerCase())) {
        const g = startGuard(await this.reader.guardInput(r.market, block));
        guardOk = g.ok;
        if (!g.ok) this.noteWait(r.id, g.reason);
      }
      const d = decide(r, block, () => guardOk);
      if (!d) continue;
      if ("wait" in d) {
        this.noteWait(r.id, d.wait);
        continue;
      }
      const ok = await this.act(r.id, d.action, block);
      acted.push({ id: r.id, action: d.action, ok });
    }
    return { block, acted };
  }

  private noteWait(id: bigint, why: string) {
    if (this.lastWait.get(id) === why) return;
    this.lastWait.set(id, why);
    this.log(`raid ${id}: waiting, ${why}`);
  }

  private async act(id: bigint, action: Action, block: bigint): Promise<boolean> {
    const key = `${id}:${action}`;
    try {
      const fee = action === "close" ? await this.reader.entropyFee(block) : 0n;
      const sent = await this.signer.send(buildTx(this.vault, action, id, fee));
      if (!sent.ok) throw new Error(`reverted ${sent.hash}`);
      this.log(`raid ${id}: ${action} ${sent.hash}`);
      this.failures.delete(key);
      this.inflight.set(id, sent.block);
      return true;
    } catch (e) {
      const n = (this.failures.get(key) ?? 0) + 1;
      this.failures.set(key, n);
      const msg = (e as Error).message.split("\n")[0];
      this.log(`raid ${id}: ${action} failed (${n}): ${msg}`);
      if (n === ALERT_AFTER_FAILURES) await this.alert(`raid ${id} ${action} failed twice: ${msg}`);
      return false;
    }
  }
}
