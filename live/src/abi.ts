import { parseAbi, parseAbiItem } from "viem";

// Struct field order: contracts/src/interfaces/IRaid.sol and contracts/src/RaidVault.sol (Raid).
export const vaultAbi = parseAbi([
  "struct Terms { address market; address prizeToken; uint96 wallSize; uint128 bounty; uint128 target; uint128 seatCap; uint64 w0; uint64 w1; uint32 hold; uint16 capBps; uint8 anchorMode; uint256 anchorParam; }",
  "struct Raid { Terms terms; address sponsor; uint8 status; uint32 capPrice; uint40 wallId; address maker; uint64 endBlock; uint64 entropySeq; uint64 requestBlock; uint64 settledAt; bool won; bool wallRecovered; uint128 fromRollover; uint256 countedTotal; uint256 baseAmount; }",
  "function raidCount() view returns (uint256)",
  "function raid(uint256 raidId) view returns (Raid)",
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
  "function getMarketParams() view returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256)",
]);

export const raidedEvent = parseAbiItem(
  "event Raided(uint256 indexed raidId, address indexed player, bytes32 indexed seatKey, uint256 blockNumber, uint256 baseOut, uint256 quoteSpent, uint256 wallFillQuote, uint256 countedAdded)",
);
export const seatBoundEvent = parseAbiItem(
  "event SeatBound(uint256 indexed raidId, bytes32 indexed seatKey, address indexed player, uint8 kind, address holder, uint256 tokenId)",
);

export const settledEvent = parseAbiItem(
  "event Settled(uint256 indexed raidId, bool won, uint256 countedTotal, uint96 wallSold)",
);

export const STATUS = ["None", "Posted", "Open", "Closing", "Closed", "Settled", "Aborted"] as const;
export type StatusName = (typeof STATUS)[number];
