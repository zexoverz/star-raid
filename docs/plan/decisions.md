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
