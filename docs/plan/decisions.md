# Decisions made during the build

Each entry: the claim, why, and what would reverse it. Newest last.

## D1. Kuru is vendored from source for local tests (5 Oct)

**Claim.** `contracts/lib/kuru` is `Kuru-Labs/Kuru-contracts-dex-public` pinned at `2060bb27`. Unit
tests deploy Kuru's own `Router`, `MarginAccount`, `OrderBook` and `KuruAMMVault` the way Kuru's tests
do, instead of mocking the book. OpenZeppelin is pinned at `v5.5.0` (Kuru's `foundry.lock`), solady at
`v0.1.26` (Kuru does not pin it).

**Why.** Rules 4 to 7 are about how Kuru actually behaves (sizes kept on full fills, cancel reverts,
FIFO by head). A mock would encode our reading of Kuru instead of Kuru.

**Reverses it.** Evidence that the deployed mainnet implementation differs from `2060bb27` in a path
we use. The fork tests exist to catch that.

## D2. E1 fork tests run on MON/USDC, not the LST markets (5 Oct)

**Claim.** The review asked to move fork tests to the LST markets. They stay on MON/USDC
(`0x065C…C394`).

**Why.** At block ~110,699,000 on 143 all three LST markets read `marketState() == 1`
(`SOFT_PAUSED`): shMON/MON `0xcc46a703345a18c4ef4be20a447dc8613f0aebc4`, sMON/MON
`0xac758746cc4c54751623a84dc085b9b39b661b73`, gMON/MON `0x1ca0f16a316c3ee0ff3cec5382caad5648ea512d`.
`addSellOrder` and `addBuyOrder` carry `marketActive` (`OrderBook.sol:76-79`), so no wall can be
placed there. MON/USDC reads `0` (active). The Kuru behaviour under test is the same contract code.

**This also blocks the mainnet LST raids in SPEC §16** until Kuru unpauses those markets. Ask Kuru
(draft, his go). Full addresses and params of the three markets came from `MarketRegistered` on the
Kuru Router `0xd651…95CC` via HyperSync (597 markets, matching SPEC §2): all three are
native-MON-quoted, `pricePrecision` 1e6, `sizePrecision` 1e11, `tick` 100, `minSize` 200 tokens.

**Reverses it.** Kuru sets the LST markets back to `ACTIVE`; then add the same tests against shMON/MON.

## D3. Wall fill = remaining before minus remaining after, with remaining read through the head

**Claim.** `KuruBook.remaining(id)` is the order's size only while `status(id) == Active`, else 0.
Wall fill per buy is `remaining(wall)` before minus after, inside the router's own call.

**Why.** Rule 4: a fully filled order can keep its old size (`OrderBook.sol:1155-1160`), so size alone
would report a filled wall as still holding base. Inside one call nobody else can touch the wall, so
the difference is exactly this buy's fill (C1 counting).

**Reverses it.** A Kuru upgrade that zeroes size on every fill (still safe) or reorders the head
update (would break status itself).

## D4. The mid guard is one-sided (E2 open)

**Claim.** Open uses `ref = max(anchor, Kuru mid)` and aborts only when the mid is more than 20 bps
**above** the anchor. A mid below the anchor is ignored.

**Why.** M3 asked for ≤20 bps divergence both ways. On 5 Oct the shMON/MON book mid was ~1.612 MON
against a `convertToAssets` rate of 1.6307: LSTs trade under redemption, so a two-sided check would
abort every LST raid. A low mid cannot hurt anyone, since the cap comes from the anchor and raiders
pay at most the cap. A high mid is the dangerous case (pushed book, or a wrong anchor) and still aborts.

**Reverses it.** A market where the anchor can be pushed up while the book stays put. Then add a floor
on mid as well.

## D5. Contract window bounds are 40 to 400 blocks

**Claim.** `post` accepts `w1 - w0` in [40, 400]. The 200-260 block window of SPEC §16 is the keeper's
and the lobby's policy, not a contract limit.

**Why.** Testnet rehearsals and the demo need short raids; the contract only has to stop windows so
long that `E` loses meaning. `E` is always drawn from the last quarter (M1).

**Reverses it.** Mainnet raids being posted outside 200-260; then tighten the constant.

## D6. The prize is its own ERC-20; the 10x target rule applies only when it is the quote

**Claim.** `Terms.prizeToken` is any ERC-20 (USDC in practice). `post` requires `target ≥ 10 × bounty`
only when the prize token is the market's quote token. The bounty is a fixed pot paid pro rata to
counted wall fill, not bps of wall fill (H1 is met in reporting: cost per token distributed).

**Why.** LST markets are MON-quoted while bounties are USDC, so the units do not compare on chain.

**Reverses it.** A sponsor wanting the prize in the quote of a MON market; then add an oracle check.

## D7. Open aborts on any anchor or wall failure, and the abort is final

**Claim.** If the anchor fails, the mid guard fires, no empty level is found within 5 ticks, or the
postOnly wall reverts (a bid at the cap, or the market paused), `open` aborts and refunds in the same
transaction. `expire()` refunds a raid not opened by `w0 + 30`.

**Why.** A raid that cannot place its wall at its terms should not wait for a better moment the
sponsor did not agree to. The keeper runs the start guard before calling `open`, so this is the backstop.

**Reverses it.** Frequent aborts from transient oracle staleness; then let the keeper retry inside the
open window instead.

## D8. Admin-cancelled walls are tested by cancelling as the maker

**Claim.** The admin-cancel settle test cancels the wall as its own maker. It does not impersonate
Kuru's Safe.

**Why.** The two admin functions (`0xce988a10`, `0x0544a0d5`) are not in the public source, so their
arguments are unknown. What settle depends on is the end state (order deleted, price 0, base credited
to the maker's margin), which a normal cancel produces through the same `_executeCancel` path
(`OrderBook.sol:549-597`). Settle reads the head, skips the cancel, and drains the margin either way.

**Reverses it.** Decoding the admin functions from bytecode and finding they credit somewhere other
than the maker's margin. The sweep also drains the maker's raw token balance to cover a direct transfer.

## D9. The Entropy fee is paid by whoever calls `close`

**Claim.** `close` is payable, reads `getFeeV2()`, forwards exactly the fee and refunds the rest.

**Why.** The keeper holds MON for fees (DESIGN §4); this avoids a fee reserve inside the vault.

**Reverses it.** Wanting closes to be free for third parties; then add a fee reserve funded at post.

## D10. Bind signs the holder and player only, not token ids; ERC-1271 is accepted

**Claim.** `Bind(address holder, address player, uint64 expiry)`. The seat is the holder wallet; any
Star it owns at raid time proves it. `SignatureChecker` accepts contract-wallet holders (Safes).

**Why.** After C2 a seat is one per holder, so which Star proves it does not change anything, and a
token list would make a Bind go stale when the holder buys or sells a Star. A token id is still
nullified per raid to its first holder, so a Star moved mid-raid cannot open a second seat.

**Reverses it.** A need to let one holder split its Stars across players; that would undo C2.

## D11. Raids run only on owner-allowlisted markets

**Claim.** `post` requires `marketAllowed[market]`, set by the vault owner.

**Why.** `market` is sponsor input. A fake book could report fake wall fills to the router, or feed
the maker clone hostile calls. The margin account is fixed at deploy, so raiders' funds were not at
risk, but counts and the prize were.

**Reverses it.** Reading Kuru's Router `verifiedMarket` on chain instead; equivalent, and it removes
an admin step, but it trusts Kuru's registry for markets we have not looked at.

## D12. The router's status check before cancelling its own remainder is defensive

**Claim.** The router still checks the head before `batchCancelOrders` on its remainder, but no test
fails without it, and that is expected.

**Why.** The remainder is created at the end of `addBuyOrder` in the same call (`OrderBook.sol:205-209`)
and nothing can fill it before our cancel, so it is always active there. Rule 7 bites in settle, where
the wall may be filled or admin-cancelled; that path has its test (`test_settleFilledWallDoesNotCancel`,
mutation killed).

**Reverses it.** Nothing; the check costs one SLOAD pair.

## D13. MON-quoted markets take native MON; USDC markets refuse it

**Claim.** The router takes the market's quote: ERC-20 by allowance with `msg.value == 0`
(`NativeNotAccepted` otherwise, rule 9's test), or native MON only when the quote is native.

**Why.** SPEC §16 moves mainnet raids to MON-quoted LST markets, where paying in MON is the only way to
buy. Rule 9 still holds on every USDC market. Raider accounts on MON markets keep 10 MON (reserve
balance), which is app copy.

**Reverses it.** Mainnet staying on USDC markets only; then drop the native path.

## D14. A lost raid releases base at settle, with no hold

**Claim.** `claim` checks the hold only when the raid was won.

**Why.** The hold protects the prize from instant dumpers. With no prize there is nothing to protect,
and keeping raiders' tokens locked would only cost them.

**Reverses it.** A sponsor asking for a hold on every raid regardless of outcome.

## D15. Pro-rata rounding dust stays in the router

**Claim.** Each share is `pot × counted / total`, rounded down. Dust (at most one unit per seat)
stays in the router.

**Why.** Sweeping it adds a code path for less than a cent.

**Reverses it.** Prize tokens with few decimals, where the dust is real money.

## D16. Live check of SPEC §2.4 on 5 Oct

The MON/USDC fork raid (`test_fork_fullRaidOnLiveBook`) needed about $20k of buying to get through the
cheaper live asks to a wall at mid + 50 bps; $5k did not reach it. That confirms C1's consequence:
raids on deep markets almost never reach the wall.

## D17. Testnet Entropy is `0x825c…3c07`, not the mainnet address

**Claim.** On Monad testnet the Pyth Entropy contract is `0x825c0390f379C631f3Cf11A82a37D20BddF93c07`
(fee ~0.128 MON on 5 Oct). Mainnet is `0xD458261E832415CFd3BAE5E416FdF3230ce6F134`.

**Why.** `0xD458…` also has code on testnet, but its default provider is unregistered there and
`requestV2()` reverts `NoSuchProvider()` (`0xdf51c431`). This was caught by the testnet fork raid,
and Pyth's chainlist confirms the address. The vault takes Entropy as a constructor argument, so this
is deploy config.

## D18. The start guard runs on liquid markets only

**Claim.** The keeper applies the trade-based start guard only to markets not listed in
`THIN_MARKETS`. The testnet market is thin by default.

**Why.** The guard exists so outside buyers on a busy book do not lift the wall during the window.
On a thin market the wall is the whole ask side and nothing trades, so "last trade ≤300 blocks" would
refuse every raid forever. The contract's own mid guard (D4) still runs everywhere.

**Reverses it.** A thin market that starts trading; move it off the list.

## D19. No on-chain reschedule; a guard refusal lets the raid expire

**Claim.** The E4 ticket "reschedule inside the sponsor's slide range" is not built. If the guard
refuses through `w0 + 30`, the keeper calls `expire` and the sponsor's funds come back in full.

**Why.** Terms are immutable after post (SPEC §6). A slide range would need new terms fields and a new
code path in the vault for a case the sponsor can handle by posting again. Cut for time.

**Reverses it.** Guard refusals being common on mainnet; then add `slideMax` to the terms.

## D20. The local keeper signs through `cast`, never with an exported key

**Claim.** `CastSigner` shells out to `cast send --account zexo-secondary --password-file …` with raw
calldata. `KeySigner` (`PRIVATE_KEY`) is for a hosted run only.

**Why.** The dev wallet rule forbids exporting a keystore to a private key.

## D21. Railway is not set up yet

**Claim.** The keeper and live service run locally for the testnet rehearsal. The Railway project with
a fixed domain (E4 ticket) waits.

**Why.** Creating the project needs his Railway login, and nothing in the testnet run needs a public
URL. The app (E5) will need `live/` hosted before the demo.

## D22. A raid buy's gas limit is max(800k + 40k per maker, 1.5 × estimate), capped at 2M

**Claim.** `raidGasLimit(makers, estimate)` keeps rule 10's figure as a floor and applies SPEC §16 M8
(estimate at `latest` × 1.5) above it, never over 2,000,000.

**Why.** The anvil rehearsal on a testnet fork ran a first buy out of gas at 840k: a cold seat costs
864,189 (seat binding, two checkpoint arrays, a Kuru order created and cancelled). Rule 10's 800k came
from a bare Kuru buy measured on 26 Sep, before the router existed.

**Reverses it.** Profiling that brings a cold seat under 800k; then the floor alone is enough.

## D23. The keeper treats a sent step as in flight until finality reaches its receipt

**Claim.** After a successful send the keeper skips that raid until the finalized block is at or past
the receipt's block.

**Why.** Rule 12 has the keeper read finalized state, which lags `latest` by 2-3 blocks on Monad. The
rehearsal showed the keeper sending `open` a second time (reverted) because finalized still said
Posted.

## D30. The indexer recounts each seat at the end block; counted numbers come only from Raided

**Claim.** `Seat.counted` and `PlayerRaid.counted` sum `Raided.countedAdded` and are provisional.
On `EndDrawn` each seat is recounted from its own buys at or before `E` into `countedAtEnd`, and only
that figure is added to the player's lifetime `counted`. Kuru `Trade` logs feed `WallFill`, a display
of which part of the wall sold, and are never used to attribute or count a raider's buys (rule 6).

**Why.** `countedAdded` includes buys after `E`, which settle does not count. Summing it into lifetime
totals would overstate players. The per-seat buy lists (`buyBlocks`, `buyCounted`) make the recount
possible inside one handler without a query.

**Reverses it.** A router event that emits each seat's counted value at settle; then the recount goes.

## D31. Kuru markets are registered from Posted, and fills are kept only for our makers

**Claim.** `contractRegister` on `Posted` adds `terms.market` as a `KuruOrderBook` address. The
`Trade` handler drops every fill whose maker is not a `Maker` row created from `Opened`.

**Why.** `Opened` names the maker but not the market, and dynamic registration is by emitter address,
so the market has to come from `Posted`. On a liquid market most `Trade` rows are other people's;
storing them would be noise and HyperSync cost.

**Reverses it.** Indexing a market's full tape for the results page (cheaper asks filled vs wall);
then keep a summary entity rather than every row.

## D24. The live frame is a full raid snapshot, version 1

**Claim.** Every SSE frame carries the whole raid at one block: terms in token units, wall status,
remaining and sold, counted, end block, outcome, every buy and every seat. There are no deltas, so a
reconnect needs no replay. Market prices (`bestBid`, `bestAsk`) are gone from the frame; `capPrice`
stays inside `terms` because the confirm sheet must show it.

**Why.** The raid and results screens need the feed and the per-seat split, and the frontend has no
RPC access by design. Snapshots keep the client trivially correct across drops and reorgs. A frame
with four buys is about 4 KB; a raid with 100 raiders stays well under 100 KB.

**Reverses it.** Raids large enough that full snapshots every 400 ms cost too much bandwidth; then
send the buy list on change only.

## D25. `SeatBound` carries the Star's token id

**Claim.** `SeatBound(raidId, seatKey, player, kind, holder, tokenId)`; `tokenId` is 0 for personhood
seats.

**Why.** The raid feed shows each raider's Lil Star, and no event said which Star opened the seat.
Changed before the first testnet deploy, so nothing on chain has the old shape.

## D26. `wallSold` survives the wall being cancelled

**Claim.** Once the wall reads cancelled, `wallSold` comes from the vault's `Settled` event, or from
the last reading while the wall was live (an admin cancel mid-raid).

**Why.** The first fork capture showed the full 100k wall as sold after settle swept it, when the raid
had bought 40,385. A cancelled order has no size left on the book, so status alone cannot say what it
sold.

## D27. Rules 4 to 8 are pinned on chain 143, each checked by deleting its guard

**Claim.** `contracts/test/fork/Rules.fork.t.sol` holds one test per rule against Kuru's live MON/USDC
book, real Lil Stars and real Entropy. Each guard was deleted in a scratch worktree and its named test
run on a 143 fork (5 Oct, blocks ~110,726,900 to 110,727,200). All nine mutants went red.

| Rule | Guard deleted | Red with |
|---|---|---|
| 4 | status read from size instead of the level head | `OrderAlreadyFilledOrCancelled()` from Kuru, in the sweep |
| 5 | buy placed above the cap | "filled above the cap" (a Trade above `capPrice`) |
| 5 | remainder left resting | "the router's remainder is still on the book" |
| 5 | `placeAndExecuteMarketBuy` instead of `addBuyOrder` | "router code contains placeAndExecuteMarketBuy" |
| 6 | fill assumed from the size asked | `InsufficientBalance()` from Kuru's MarginAccount |
| 6 | absolute margin balance instead of the difference | "escrow equals the fills" (off by the donation) |
| 7 | cancel without the status check | `OrderAlreadyFilledOrCancelled()` from Kuru, in the sweep |
| 8 | callback accepted from anyone | expected `OnlyEntropy()`, call did not revert |
| 8 | end block from prevrandao | "prevrandao changed E" |

A first pass found two tests that were decoration: the remainder mutant and the assumed-fill mutant
left the suite green, because the buy happened to fill completely. Both tests now buy through the wall
with an overshoot. The router's own status check before cancelling (D12) was unreachable, so the check
now lives in one place, `KuruBook.cancelIfActive`, used by the router and the sweep.

Where no custom error exists for a failure (paying above the cap is not an error anywhere, it is a
wrong result), the test fails on the exact invariant instead.

## D28. sMON has no ERC-4626 view; its rate reads as totalPooled / totalSupply

**Claim.** Kintsu sMON (`0xa3227c5969757783154c60bf0bc1944180ed81b9`, proxy to `0x6a45…f21f`)
reverts on `convertToAssets` and the usual rate getters. `totalPooled() / totalSupply()` read 1.1141 MON
per sMON on 5 Oct, against an sMON/MON book at ~1.100. Not wired: an sMON raid uses the Fixed anchor.

**Why.** The ratio is plausible but has not been checked against Kintsu's source (still CONFIRM), and the
sMON market is soft-paused anyway (D2).

**Reverses it.** Reading Kintsu's source; then add a small rate adapter and use VaultRate.

## D29. Monad testnet deployment (6 Oct)

Deployed by `zexo-main` from `contracts/script/DeployTestnet.s.sol` at block 68548970 on chain 10143;
the machine-readable copy is `deployments/testnet.json`. The keeper is `zexo-secondary`.

| Contract | Address |
|---|---|
| vault | `0xE4C81a5717bb9E4b8C2FF87a96AcA56FA2480E89` |
| router | `0x653363d9EfE33898DB7948FB78EB30c43e0B8498` |
| seatGate | `0xc2aB9E8b765730bd8E540810a9fC937c7BA89472` |
| wallMakerImpl | `0x5B6E01d2fba8D956cFAD9470baA38F97A21D8c3C` |
| market | `0xA2D5f9feD74DB8b37322436fFcb43E672a6e396E` |
| baseToken | `0xE291ddE058a1Fb128B8baA3a7F80BB12Eca5b171` |
| quoteToken | `0x8cfd81e42052a502da01a0884F4De804d0C1Eb4B` |
| lilStars | `0x5A3B6dBff7d9Eea9E2fcfd22FaAf0959D4057BFF` |
| entropy | `0x825c0390f379C631f3Cf11A82a37D20BddF93c07` |
| kuruRouter | `0x7EFbE105Ca7415dE98F96622173458ac1c054630` |
| kuruMarginAccount | `0xd029C2D98ff85D8F64799017fE00a59B1159CE02` |
| keeper | `0x720633667161625FC1d7fd86DE6eC06d814a3492` |

`market` is a fresh Kuru market (tSTAR/tUSDC, price precision 1e8, size precision 1e10, tick 100, min
size 100 tSTAR, fees 0) made through Kuru's testnet Router, so the wall is the only ask. `baseToken`,
`quoteToken` and `lilStars` are test stand-ins anyone can mint.

**Sourcify.** Vault, router, seat gate, wall maker implementation and the three test tokens are
verified at `match`, not `exact_match`: `foundry.toml` had `bytecode_hash = "none"`, so the bytecode
carries no metadata hash to match exactly. The setting is removed for the mainnet deploy. Redeploying
testnet only for this would have cost the MON the end-to-end raid needed, so it was left.

## D32. Testnet raids run by the keeper (6 Oct)

Driven end to end by `scripts/testnet-run.sh` on the D29 deployment: the sponsor (`zexo-main`) posts,
the keeper opens, raiders buy through the router, the keeper closes with a real Pyth Entropy request,
Pyth's provider delivers the end block, the keeper settles, the seat claims after a 60 s hold.

| Raid | Outcome | Seats | Counted buys | Buys with no seat (uncounted) | Counted / target (tUSDC) | Wall share of spend | Wall sold | End block |
|---|---|---|---|---|---|---|---|---|
| 1 | expired, refunded | 0 | 0 | 0 | 0 / 500 | | 0 | |
| 2 | expired, refunded | 0 | 0 | 0 | 0 / 500 | | 0 | |
| 3 | won | 2 | 2 | 1 | 749.99 / 500 | 100% | 34.6% | 68,550,125 |
| 4 | won | 1 | 1 | 1 | 599.99 / 500 | 100% | 28.9% | 68,551,043 |

Raids 1 and 2 expired because raider setup ran past `w0 + 30` (the driver now posts after setup);
the keeper refunded both in full. On this market the wall is the only ask, so every unit bought came
out of the sponsor's wall. Raid 3's end block was requested at 68,550,153 (sequence 3948, fee 0.128 MON)
and delivered at 68,550,161 by Pyth's provider through `0x825c…3c07`; raid 4's at 68,551,084. Both are
real draws, not the timeout. Raiders on testnet are the team's own throwaway wallets, so these numbers
show the mechanism working, not demand.

The first real-RPC run also showed `live/` sending finalized frames only: on public testnet a read takes
longer than the finalized poll, and finalized reads always won the queue. Proposed and finalized now
take turns (raid 4 stream: 32 proposed, 33 finalized frames).

## D33. `live/` is hosted on Railway; the keeper is not

**Claim.** Railway project `star-raid`, service `live`, deployed from `live/` with `CHAIN=testnet` and
the D29 addresses: https://live-production-e50b.up.railway.app (`/health`, `/raids/:id`,
`/raids/:id/stream`). The keeper still runs locally (`keeper/`, `pnpm start`).

**Why.** The frontend needs a public SSE endpoint. A hosted keeper needs a private key in Railway, and the
dev wallet rule forbids exporting `zexo-secondary`; the clean way is a fresh keeper key set with
`vault.setKeeper`, which is his call, and it is only needed once raids run on a schedule.

**Reverses it.** Scheduled raids; then create a dedicated keeper key, fund it, `setKeeper`, and add a
`keeper` service with `PRIVATE_KEY` as a Railway secret.

## D34. A hosted keeper with its own key runs demo raids on testnet

**Claim.** The vault's keeper is now `0x0014e80b2B94069F957A7C068381D551C66a75F4`, a fresh key generated
straight into the Railway `keeper` service as `PRIVATE_KEY` and never written anywhere else. It runs the
lifecycle of every raid and, with `DEMO_EVERY_MIN=60`, posts a demo raid when none is in flight, so the
app always has something live to build against. `zexo-secondary` is no longer the keeper; `setKeeper`
from `zexo-main` reverses it.

**Why.** The frontend needs raids that run without anyone's local machine, and the dev keystores must
never be exported (D20, D33). Fees are capped at 1.25 x base fee plus a 2 gwei tip, and a failing step
backs off up to a minute, after the first hosted run spent its 0.4 MON and then retried settle every
second.

**Cost.** Each demo raid costs the keeper about 0.35 testnet MON (post, open, close with the Entropy
fee, settle). It needs topping up from the faucet.
