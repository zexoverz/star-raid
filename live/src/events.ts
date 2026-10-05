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

/**
 * Raided and SeatBound logs. Logs at or below the finalized block are kept; the tentative tail above
 * it is re-read on every sync, so a reorged buy disappears from proposed frames and never reaches a
 * finalized one.
 */
export class EventStore {
  private final: Batch = { buys: [], seats: [], settled: [] };
  private tail: Batch = { buys: [], seats: [], settled: [] };
  private finalizedTo: bigint;

  constructor(
    private client: LogSource,
    private router: Address,
    private gate: Address,
    private vault: Address,
    startBlock: bigint,
  ) {
    this.finalizedTo = startBlock - 1n;
  }

  async sync(head: bigint, finalized: bigint) {
    if (finalized > head) finalized = head;
    if (finalized > this.finalizedTo) {
      const got = await this.fetch(this.finalizedTo + 1n, finalized);
      this.final.buys.push(...got.buys);
      this.final.seats.push(...got.seats);
      this.final.settled.push(...got.settled);
      this.finalizedTo = finalized;
    }
    this.tail = head > this.finalizedTo ? await this.fetch(this.finalizedTo + 1n, head) : { buys: [], seats: [], settled: [] };
  }

  /** Logs of one raid up to `block` (inclusive). */
  forRaid(raidId: bigint, block: bigint) {
    const buys = [...this.final.buys, ...this.tail.buys].filter((b) => b.raidId === raidId && b.block <= block);
    const seats = [...this.final.seats, ...this.tail.seats].filter((s) => s.raidId === raidId && s.block <= block);
    const settled = [...this.final.settled, ...this.tail.settled].find((s) => s.raidId === raidId && s.block <= block);
    return { buys, seats, settled };
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
