// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

enum AnchorMode {
    Fixed, // sponsor-fixed price in Kuru price units (new or dead markets)
    VaultRate, // base is an ERC-4626 LST; convertToAssets in the quote asset
    Oracle // Chainlink + Pyth USD price, for USD-quoted markets
}

enum RaidStatus {
    None,
    Posted,
    Open,
    Closing,
    Closed,
    Settled,
    Aborted
}

struct Terms {
    address market; // Kuru OrderBook
    address prizeToken; // ERC-20 the bounty is paid in
    uint96 wallSize; // Kuru size units
    uint128 bounty; // prize token units
    uint128 target; // quote token units of counted wall fill
    uint128 seatCap; // max counted quote per seat
    uint64 w0; // first block buys are allowed
    uint64 w1; // last block buys are allowed
    uint32 hold; // seconds after settle before claim
    uint16 capBps; // cap over the reference price
    AnchorMode anchorMode;
    uint256 anchorParam; // Fixed: price in Kuru units; otherwise unused
}

/// What the router needs to know about a raid.
struct RaidView {
    RaidStatus status;
    address sponsor;
    address market;
    address base;
    address quote;
    address prizeToken;
    address maker;
    uint40 wallId;
    uint32 capPrice;
    uint64 w0;
    uint64 w1;
    uint64 endBlock;
    uint64 settledAt;
    uint32 hold;
    uint128 seatCap;
    bool won;
}

interface IRaidVault {
    function raidView(uint256 raidId) external view returns (RaidView memory);
    function isExcluded(uint256 raidId, address who) external view returns (bool);
    function creditForfeit(uint256 raidId, uint256 amount) external;
}

interface IRaidRouter {
    /// Σ over seats of min(seat's counted wall fill in blocks <= endBlock, seatCap).
    function countedTotalAt(uint256 raidId, uint64 endBlock) external view returns (uint256);
    /// Called by the vault after it transfers the prize on a win.
    function fundPrize(uint256 raidId, uint256 amount, uint256 countedTotal) external;
}
