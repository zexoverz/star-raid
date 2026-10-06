import type { Address, Hex, PublicClient } from "viem";
import { raidedEvent, seatBoundEvent, settledEvent } from "./abi.js";

export const NO_SEAT = `0x${"0".repeat(64)}` as Hex;
const LOG_CHUNK = 100n; // public RPC caps eth_getLogs at 100 blocks

export interface BuyLog {
  id: string; // `${txHash}:${logIndex}`, stable across frames
  raidId: bigint;
  block: bigint;
  tx: Hex;
  player: Address;
  seatKey: Hex;
  baseOut: bigint;
  quoteSpent: bigint;
  wallFillQuote: bigint;
  countedAdded: bigint;
}

export interface SeatLog {
  raidId: bigint;
  block: bigint;
  seatKey: Hex;
  player: Address;
  kind: number;
  holder: Address;
  tokenId: bigint;
}

export interface SettledLog {
  raidId: bigint;
  block: bigint;
  wallSold: bigint; // Kuru size units, read by settle before the wall was swept
}

type LogSource = Pick<PublicClient, "getLogs">;

const SETTLE_SCAN_LIMIT = 30_000n; // blocks after w1 to look for a raid's Settled log (about 3.3 h)

/**
 * Raided, SeatBound and Settled logs. History is read per raid, inside that raid's own window, so a
 * restart costs a few calls per raid instead of a scan of the whole chain since deploy. From the block
 * the service started at, everything is followed live: logs at or below the finalized block are kept,
 * and the tentative tail above it is re-read on every sync, so a reorged buy disappears from proposed
 * frames and never reaches a finalized one.
 */
export class EventStore {
  private buys = new Map<string, BuyLog>();
  private seats = new Map<string, SeatLog>();
  private settledLogs = new Map<bigint, SettledLog>();
  private tail: Batch = { buys: [], seats: [], settled: [] };
  private finalizedTo: bigint | null = null; // live following covers (historyEnd, finalizedTo]
  private historyEnd = 0n; // blocks at or below this are read per raid by backfill()
  private backfilled = new Set<bigint>();

  constructor(
    private client: LogSource,
    private router: Address,
    private gate: Address,
    private vault: Address,
  ) {}

  async sync(head: bigint, finalized: bigint) {
    if (finalized > head) finalized = head;
    if (this.finalizedTo === null) {
      this.finalizedTo = finalized;
      this.historyEnd = finalized;
    }
    if (finalized > this.finalizedTo) {
      this.keep(await this.fetch(this.finalizedTo + 1n, finalized));
      this.finalizedTo = finalized;
    }
    this.tail = head > this.finalizedTo ? await this.fetch(this.finalizedTo + 1n, head) : { buys: [], seats: [], settled: [] };
  }

  /** Read one raid's history (at or before the block the service started at), once. */
  async backfill(raid: { raidId: bigint; w0: bigint; w1: bigint; settled: boolean }) {
    if (this.backfilled.has(raid.raidId) || this.finalizedTo === null) return;
    const end = this.historyEnd;
    if (raid.w0 <= end) this.keep(await this.fetch(raid.w0, raid.w1 < end ? raid.w1 : end));
    if (raid.settled && raid.w1 < end && !this.settledLogs.has(raid.raidId)) {
      const stop = raid.w1 + SETTLE_SCAN_LIMIT < end ? raid.w1 + SETTLE_SCAN_LIMIT : end;
      for (let a = raid.w1 + 1n; a <= stop && !this.settledLogs.has(raid.raidId); a += LOG_CHUNK) {
        this.keep(await this.fetch(a, a + LOG_CHUNK - 1n < stop ? a + LOG_CHUNK - 1n : stop));
      }
    }
    this.backfilled.add(raid.raidId);
  }

  /** Logs of one raid up to `block` (inclusive). */
  forRaid(raidId: bigint, block: bigint) {
    const buys = [...this.buys.values(), ...this.tail.buys].filter((b) => b.raidId === raidId && b.block <= block);
    const seats = [...this.seats.values(), ...this.tail.seats].filter((s) => s.raidId === raidId && s.block <= block);
    const kept = this.settledLogs.get(raidId);
    const settled = (kept && kept.block <= block ? kept : undefined) ?? this.tail.settled.find((s) => s.raidId === raidId && s.block <= block);
    return { buys, seats, settled };
  }

  private keep(b: Batch) {
    for (const x of b.buys) this.buys.set(x.id, x);
    for (const x of b.seats) this.seats.set(`${x.raidId}:${x.seatKey}`, x);
    for (const x of b.settled) this.settledLogs.set(x.raidId, x);
  }

  private async fetch(from: bigint, to: bigint) {
    const buys: BuyLog[] = [];
    const seats: SeatLog[] = [];
    const settled: SettledLog[] = [];
    for (let a = from; a <= to; a += LOG_CHUNK) {
      const b = a + LOG_CHUNK - 1n < to ? a + LOG_CHUNK - 1n : to;
      const logs = await this.client.getLogs({
        address: [this.router, this.gate, this.vault],
        events: [raidedEvent, seatBoundEvent, settledEvent],
        fromBlock: a,
        toBlock: b,
      });
      for (const l of logs as Array<{ eventName: string; args: Record<string, unknown>; blockNumber: bigint; transactionHash: Hex; logIndex: number }>) {
        const x = l.args;
        if (l.eventName === "Raided") {
          buys.push({
            id: `${l.transactionHash}:${l.logIndex}`,
            raidId: x.raidId as bigint,
            block: l.blockNumber,
            tx: l.transactionHash,
            player: x.player as Address,
            seatKey: x.seatKey as Hex,
            baseOut: x.baseOut as bigint,
            quoteSpent: x.quoteSpent as bigint,
            wallFillQuote: x.wallFillQuote as bigint,
            countedAdded: x.countedAdded as bigint,
          });
        } else if (l.eventName === "Settled") {
          settled.push({ raidId: x.raidId as bigint, block: l.blockNumber, wallSold: x.wallSold as bigint });
        } else {
          seats.push({
            raidId: x.raidId as bigint,
            block: l.blockNumber,
            seatKey: x.seatKey as Hex,
            player: x.player as Address,
            kind: Number(x.kind),
            holder: x.holder as Address,
            tokenId: x.tokenId as bigint,
          });
        }
      }
    }
    return { buys, seats, settled };
  }
}

type Batch = { buys: BuyLog[]; seats: SeatLog[]; settled: SettledLog[] };
