import { STATUS } from "./abi.js";
import { wallRemaining, wallStatus, type WallStatus } from "./wall.js";

export type FrameState = "proposed" | "finalized";

export interface RaidSnapshot {
  raidId: bigint;
  status: number;
  wallId: bigint;
  endBlock: bigint;
  orderPrice: number;
  orderSize: bigint;
  levelHead: bigint;
  counted: bigint;
  seatBuys: bigint;
  nonSeatBuys: bigint;
  bestBid: bigint;
  bestAsk: bigint;
}

/** JSON-safe frame: bigints as decimal strings. */
export interface Frame {
  raidId: string;
  block: string;
  state: FrameState;
  status: string;
  wall: WallStatus;
  wallRemaining: string;
  counted: string;
  seatBuys: string;
  nonSeatBuys: string;
  bestBid: string;
  bestAsk: string;
  endBlock: string;
}

export function buildFrame(s: RaidSnapshot, block: bigint, state: FrameState): Frame {
  return {
    raidId: s.raidId.toString(),
    block: block.toString(),
    state,
    status: STATUS[s.status] ?? "Unknown",
    wall: wallStatus(s.wallId, s.orderPrice, s.levelHead),
    wallRemaining: wallRemaining(s.wallId, s.orderPrice, s.orderSize, s.levelHead).toString(),
    counted: s.counted.toString(),
    seatBuys: s.seatBuys.toString(),
    nonSeatBuys: s.nonSeatBuys.toString(),
    bestBid: s.bestBid.toString(),
    bestAsk: s.bestAsk.toString(),
    endBlock: s.endBlock.toString(),
  };
}
