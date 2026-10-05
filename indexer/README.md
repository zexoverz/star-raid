# Star Raid indexer

Envio HyperIndex (`envio` 3.12.1) over Monad. It feeds raid history, leaderboards and the results
page. The live raid bar never waits for it; that comes from `live/`.

## What it indexes

- `RaidVault`: `Posted`, `Opened`, `Aborted`, `CloseRequested`, `EndDrawn`, `Settled`,
  `WallRecovered`, `RolloverCredited`.
- `RaidRouter`: `Raided`, `PrizeFunded`, `Claimed`, `ExitedEarly`.
- `SeatGate`: `SeatBound`.
- Kuru `Trade` on each raid's market, registered from `Posted`. Only fills whose maker is a raid's
  `WallMaker` clone (from `Opened`) become `WallFill` rows; everything else on the market is dropped.

Entities are `Raid`, `Seat`, `Buy`, `Player`, `PlayerRaid` (the per-raid leaderboard), `WallFill`,
`Maker` and `Rollover`. The all-time leaderboard is `Player` ordered by `counted`.

Counted numbers come only from the router's `Raided.countedAdded`, never from `Trade` logs
(AGENTS.md rule 6). Until a raid's end block is drawn, `Seat.counted` and `PlayerRaid.counted` are
provisional, because they include buys after `E`. On `EndDrawn` each seat is recounted from its own
buys at or before `E` into `countedAtEnd`, and only that figure is added to `Player.counted`.
`Raid.countedTotal` is the value settle used. Nothing here is a price, a profit or a loss.

## Run

```bash
pnpm install
pnpm codegen     # regenerates .envio/types.d.ts from config.yaml and schema.graphql
pnpm test        # simulated events, no network
pnpm dev         # local indexer with Postgres and Hasura; needs Docker running
```

`ENVIO_API_TOKEN` (the HyperSync token) goes in `.env`, which is gitignored. See `.env.example`.

Before running against the testnet deploy, fill the three `TODO-DEPLOY` addresses and `start_block`
in `config.yaml` from the output of `contracts/script/DeployTestnet.s.sol`.

## Hosted deploy (needs his GitHub login)

1. Open https://envio.dev/app and sign in with GitHub as `zexoverz`.
2. Add an indexer, pick the `zexoverz/star-raid` repo, set the root directory to `indexer`, the
   config file to `config.yaml`, and the deploy branch to `main`.
3. Install the Envio GitHub app on the repo when asked.
4. Push to `main` (or redeploy from the dashboard). The dashboard shows the GraphQL endpoint; give
   that URL to the app as its indexer endpoint.
