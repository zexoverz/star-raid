import { parseAbi } from "viem";

// RaidView field order: contracts/src/interfaces/IRaid.sol
export const vaultAbi = parseAbi([
  "struct RaidView { uint8 status; address sponsor; address market; address base; address quote; address prizeToken; address maker; uint40 wallId; uint32 capPrice; uint64 w0; uint64 w1; uint64 endBlock; uint64 settledAt; uint32 hold; uint128 seatCap; bool won; }",
  "function raidCount() view returns (uint256)",
  "function raidView(uint256 raidId) view returns (RaidView)",
]);

export const routerAbi = parseAbi([
  "function countedTotalAt(uint256 raidId, uint64 endBlock) view returns (uint256)",
  "function seatBuys(uint256 raidId) view returns (uint256)",
  "function nonSeatBuys(uint256 raidId) view returns (uint256)",
]);

// contracts/src/lib/KuruBook.sol
export const bookAbi = parseAbi([
  "function s_orders(uint40 id) view returns (address ownerAddress, uint96 size, uint40 prev, uint40 next, uint40 flippedId, uint32 price, uint32 flippedPrice, bool isBuy)",
  "function s_sellPricePoints(uint256 price) view returns (uint40 head, uint40 tail)",
  "function bestBidAsk() view returns (uint256 bid, uint256 ask)",
]);

export const STATUS = ["None", "Posted", "Open", "Closing", "Closed", "Settled", "Aborted"] as const;
export type StatusName = (typeof STATUS)[number];
/** Raids the live service follows: from open until the end block is known. */
export const LIVE_STATUSES = new Set([2, 3, 4]);
