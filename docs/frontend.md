# Building the app against Star Raid

Everything the frontend needs from the backend, on Monad testnet (chain 10143). The source of truth for
anything here is the code it points to.

## What is running

| Piece | Where |
|---|---|
| Live data (SSE) | https://live-production-e50b.up.railway.app |
| Contracts | `deployments/testnet.json` (addresses), `deployments/abi/*.json` (ABIs) |
| Keeper | hosted on Railway; opens, closes, draws the end block and settles every raid |
| Demo raids | the keeper posts one every hour when no raid is in flight, so there is usually something to watch or join |

Viewers never call the RPC for live numbers; they read `live/`. A user's own transactions (approve, raid,
claim) go through their wallet as usual.

## Live data

```
GET /raids              every raid, newest first: the latest frame without buys and seats, plus buyCount and seatCount
GET /raids/:id          { proposed?: Frame, finalized?: Frame }
GET /raids/:id/stream   SSE, one "frame" event per message
GET /health
```

The `Frame` type, the proposed and finalized rules, and reconnecting are in the contract comment on
issue #15, and in `live/src/frames.ts`. Every frame is a full snapshot: replace, never merge.

| Screen | Read from the frame |
|---|---|
| Lobby | `/raids`: `status`, `terms` (target, bounty, window, hold), `counted`, `won` |
| Raid | `counted` vs `terms.target`, `wallSold` vs `terms.wallSize`, `buys` (feed; `tokenId` is the Star), `terms.drawFrom`..`terms.w1` for the end window |
| Draw | `status` `Closing` while Pyth draws; `endBlock` when it lands; grey out `buys` with `afterEnd: true` |
| Results | `won`, `seats` (split, most counted first), `totals.wallFillQuote / totals.quoteSpent`, `nonSeatBuys` |
| Claim | `settledAt + terms.hold` is when a winning seat can claim |

Amounts are decimal strings in token units: tUSDC has 6 decimals, tSTAR 18.

## Getting a test raider ready

Anyone can mint the test tokens.

```ts
MockStars.mint(player)                 // a test Lil Star; the token id is MockStars.nextId() read before minting
MockERC20(tUSDC).mint(player, 50e6)    // 50 tUSDC
MockERC20(tUSDC).approve(router, amount)  // approve exactly what the raider chose, never more (SPEC session scope)
```

The wallet that posted a raid (the keeper, for demo raids) can never raid it.

## Joining: `RaidRouter.raid`

```solidity
function raid(uint256 raidId, uint128 quoteIn, SeatGate.Seat calldata seat) external payable;

struct Seat {
    uint8 kind;       // 0 no seat, 1 Lil Stars holder, 2 personhood
    address holder;   // kind 1: the wallet that owns the Star
    uint256 tokenId;  // kind 1: any Star the holder owns right now
    bytes32 humanId;  // kind 2 only
    uint64 expiry;    // Bind or Human signature expiry, unix seconds
    bytes sig;        // kind 1 when the player is not the holder: the holder's Bind; kind 2: the verifier's Human
}
```

- `quoteIn` is in tUSDC units. Send no native value: a USDC raid rejects `msg.value` (`NativeNotAccepted`).
- Buys are accepted while the raid is `Open` and the block is in `[terms.w0, terms.w1]`.
- The smallest buy is 100 tSTAR at the cap, about 2.6 tUSDC on the demo market (`SizeTooSmall` below that).
- A seat is one holder wallet per raid. The first wallet that raids for a holder keeps that seat for the raid.
- `kind 0` buys go through and count for nothing. Show them as such, not as an error.

**A player raiding for a holder (Mera accounts).** The holder signs EIP-712 once:

```ts
domain = { name: "StarRaid SeatGate", version: "1", chainId: 10143, verifyingContract: seatGate }
types  = { Bind: [{ name: "holder", type: "address" }, { name: "player", type: "address" }, { name: "expiry", type: "uint64" }] }
message = { holder, player, expiry }
```

Then the player sends `seat = { kind: 1, holder, tokenId, humanId: 0x0, expiry, sig }`.

**Gas.** Monad bills the gas limit, not the gas used, so always set it: `max(800_000 + 40_000 per extra
maker, estimateGas x 1.5)`, never above 2,000,000. A first buy on a fresh seat estimates about 865k.
`keeper/src/gas.ts` has `raidGasLimit`.

## Claiming: `RaidRouter.claim` and `exitEarly`

```solidity
function claim(uint256 raidId) external;      // won: after settledAt + hold, base plus the prize share; lost: base right after settle
function exitEarly(uint256 raidId) external;  // any time after settle: base now, the prize share is forfeited
```

To show what a player has: `SeatGate.playerSeat(raidId, player)` gives the seat key, then
`RaidRouter.seatOf(raidId, key)` gives `(player, escrowBase, cum, done)` and `RaidRouter.prizeOf(raidId, key)`
gives the prize share. Base bought by a seat stays in the router until claim.

## Errors and what to tell the user

| Error | Meaning |
|---|---|
| `NotOpen` | the raid is not open (not started, or already closing) |
| `OutsideWindow` | the block is before `w0` or after `w1` |
| `Excluded` | the sponsor and its listed affiliates cannot raid |
| `SizeTooSmall` / `SizeTooLarge` | the amount is under the market's minimum or over its maximum |
| `NativeNotAccepted` | MON was attached to a USDC raid |
| `NotStarOwner` | the holder does not own that Star right now |
| `TokenUsed` | that Star already opened a seat for another wallet in this raid |
| `SeatTaken` | this holder's seat belongs to another player in this raid |
| `PlayerHasSeat` | this wallet already has a different seat in this raid |
| `BadBind` / `Expired` | the holder's signature is wrong or expired |
| `BadHuman` / `HolderNeedsStarSeat` | personhood seats only (P2) |
| `NotSettled` | claims open after settle |
| `NoSeat` | this wallet has no seat in this raid |
| `HoldNotOver` | the hold has not ended; offer exit early |
| `AlreadyDone` | already claimed or exited |

## Rules for every screen

- Never show a number the chain does not show: counted buys, wall share and buys with no seat only. No
  price, no PnL, no returns. `terms.capPrice` exists only for the confirm sheet.
- The confirm sheet says, in plain words: the cap price, that cheaper asks fill first, the hold, early
  exit, and that Kuru's admin can cancel orders.
- A buy the contract refuses reverts and never reaches the chain, so no screen can count refused attempts.
  `nonSeatBuys` is what the chain shows: buys without a seat that went through and count for nothing.
