export type WallStatus = "active" | "filled" | "cancelled";

/**
 * Rule 4: status comes from the price level head, never from size. A cancelled order is deleted
 * (price 0); a fully filled order may keep its old size, so only the head moving past it tells.
 * Mirrors OrderBook.sol:604-622 at Kuru 2060bb27.
 */
export function wallStatus(id: bigint, orderPrice: number, levelHead: bigint): WallStatus {
  if (orderPrice === 0) return "cancelled";
  if (levelHead > id || levelHead === 0n) return "filled";
  return "active";
}

/** Size still resting: the stored size only while the head says the wall is active. */
export function wallRemaining(id: bigint, orderPrice: number, orderSize: bigint, levelHead: bigint): bigint {
  return wallStatus(id, orderPrice, levelHead) === "active" ? orderSize : 0n;
}
