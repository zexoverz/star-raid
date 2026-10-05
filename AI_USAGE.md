# AI use

Star Raid is built with AI assistance and this file says where, because the Metropolis rules ask and
because a reader should not have to guess.

- **Planning.** The spec, the design and the ticket breakdown were written with Claude in a planning
  session before any code, then reviewed and cut by hand. The measured sections are not AI output:
  the Kuru market figures come from 616k fills read off chain, the contract behaviour from reading
  `Kuru-Labs/Kuru-contracts-dex-public` at `2060bb27`, and the backtest from 20,194 simulated raids
  against 5,881 real book snapshot pairs.
- **Code.** Contracts, tests, keeper and app are written with Claude Code. Every diff is reviewed
  before it lands. Tests are written to fail first against the behaviour they name.
- **Not AI.** The decision of what to build, the price-cap mechanism, the seat gate, the choice to
  count only what the sponsor's wall sells, and every mainnet transaction.

Faisal Firdani is responsible for all of it, including the parts a model wrote.

## Log by ticket

| Ticket | Files written or changed (all by Claude Code) | What the human reviewed |
|---|---|---|
| E1 Kuru spine | `contracts/foundry.toml`, `contracts/src/lib/KuruBook.sol`, `contracts/test/utils/*`, `contracts/test/unit/KuruBook.t.sol`, `contracts/test/fork/KuruSpine.fork.t.sol`, `docs/plan/decisions.md` | Merged by Claude on his instruction of 5 Oct; his read of the PR diff is pending |
| E2 RaidVault | `contracts/src/RaidVault.sol`, `contracts/src/WallMaker.sol`, `contracts/src/lib/PriceAnchor.sol`, `contracts/src/interfaces/IRaid.sol`, `contracts/test/unit/RaidVault.t.sol`, `contracts/test/unit/PriceAnchor.t.sol`, `contracts/test/invariant/VaultInvariant.t.sol`, `contracts/test/utils/{Mocks,VaultFixture}.sol`, `docs/plan/decisions.md` | Merged by Claude on his instruction of 5 Oct; his read of the PR diff is pending |
| E3 RaidRouter and SeatGate | `contracts/src/RaidRouter.sol`, `contracts/src/SeatGate.sol`, market allowlist in `contracts/src/RaidVault.sol`, `contracts/test/unit/RaidRouter.t.sol`, `contracts/test/invariant/SystemInvariant.t.sol`, `contracts/test/fork/RaidFlow.fork.t.sol`, `contracts/test/utils/{MockStars,SystemFixture}.sol`, `docs/plan/decisions.md` | Merged by Claude on his instruction of 5 Oct; his read of the PR diff is pending |
| E6 Indexer | `indexer/` (config, schema, handlers, tests, README), `docs/plan/decisions.md` D30-D31 | Pending: his read of the PR diff |
