# keeper

Drives every raid in the vault through its lifecycle, acting only on finalized blocks.

| Raid state (read at `finalized`) | Keeper does |
|---|---|
| Posted, `finalized >= w0 - 8`, start guard passes | `open` |
| Posted, past `w0 + 30` | `expire` (full refund) |
| Open, past `w1` | `close`, paying the Entropy fee read from `getFeeV2()` |
| Closing, no callback 200 blocks after the request | `closeWithoutEntropy` (`E = w1`) |
| Closed | `settle` |
| Settled, wall not yet recovered | `recoverWall` |

Every send carries an explicit gas limit (`src/gas.ts`), because Monad bills the limit. A step that
fails is retried on the next tick and alerts Telegram on its second failure.

The start guard (60 s mid range ≤20 bps, 5 min trade span ≤50 bps, a trade in the last 300 blocks)
runs on liquid markets. Markets in `THIN_MARKETS` skip it: there the wall is the whole ask side and
there are no trades to read. On testnet the deployment's market is thin by default.

## Run

```
pnpm install
DEPLOYMENT=../deployments/testnet.json pnpm start          # loop
DEPLOYMENT=../deployments/testnet.json pnpm start --once   # one tick
DEPLOYMENT=../deployments/testnet.json pnpm tsx src/e2e.ts # testnet rehearsal of one whole raid
pnpm test
```

Locally it signs with the `zexo-secondary` Foundry keystore through `cast send` (the key never leaves
the keystore). Hosted, set `PRIVATE_KEY` as a secret. Optional: `RPC_URL`, `POLL_MS`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `THIN_MARKETS`.
