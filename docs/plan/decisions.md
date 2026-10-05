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
