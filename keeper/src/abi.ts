import { parseAbi } from "viem";

// Field order follows RaidView in contracts/src/interfaces/IRaid.sol.
export const vaultAbi = parseAbi([
  "function raidCount() view returns (uint256)",
  "struct RaidView { uint8 status; address sponsor; address market; address base; address quote; address prizeToken; address maker; uint40 wallId; uint32 capPrice; uint64 w0; uint64 w1; uint64 endBlock; uint64 settledAt; uint32 hold; uint128 seatCap; bool won; }",
  "function raidView(uint256 raidId) view returns (RaidView)",
  "struct Terms { address market; address prizeToken; uint96 wallSize; uint128 bounty; uint128 target; uint128 seatCap; uint64 w0; uint64 w1; uint32 hold; uint16 capBps; uint8 anchorMode; uint256 anchorParam; }",
  "struct Raid { Terms terms; address sponsor; uint8 status; uint32 capPrice; uint40 wallId; address maker; uint64 endBlock; uint64 entropySeq; uint64 requestBlock; uint64 settledAt; bool won; bool wallRecovered; uint128 fromRollover; uint256 countedTotal; uint256 baseAmount; }",
  "function raid(uint256 raidId) view returns (Raid)",
  "function entropy() view returns (address)",
  "function keeper() view returns (address)",
  "function open(uint256 raidId)",
  "function close(uint256 raidId) payable",
  "function closeWithoutEntropy(uint256 raidId)",
  "function settle(uint256 raidId)",
  "function recoverWall(uint256 raidId)",
  "function expire(uint256 raidId)",
  "function post(Terms t, address[] affiliates) payable returns (uint256)",
]);

export const entropyAbi = parseAbi(["function getFeeV2() view returns (uint128)"]);

export const bookAbi = parseAbi([
  "function bestBidAsk() view returns (uint256, uint256)",
  "function getMarketParams() view returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256)",
]);

// One topic each (DESIGN §2); decode the data.
export const tradeEvent = parseAbi([
  "event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)",
])[0];

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
]);
