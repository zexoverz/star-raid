# live

One upstream connection to Monad, fanned out to every raid viewer over Server-Sent Events. No viewer
ever talks to the RPC (public RPCs allow 15-25 req/s).

- New heads arrive over a WebSocket (`watchBlockNumber`); if it fails the service polls HTTP every
  400 ms.
- Per head: **one multicall** at that block for every live raid (status Open, Closing or Closed):
  the wall's order and price level, `bestBidAsk`, `countedTotalAt(id, block)`, `seatBuys`,
  `nonSeatBuys`. It is sent as a `proposed` frame.
- The `finalized` block is polled separately; when it advances the same reads run at that block and
  go out as a `finalized` frame (rule 12: the UI shows `proposed` as tentative and firms it on
  `finalized`).
- Wall remaining comes from the price level head, never from the order size (rule 4).

## Endpoints

| | |
|---|---|
| `GET /raids/:id/stream` | SSE, `event: frame`, heartbeat comment every 15 s; sends the cached frames on connect |
| `GET /raids/:id` | `{ proposed, finalized }`, the last frame of each kind |
| `GET /health` | head source, last proposed and finalized blocks, read errors |

A frame: `{ raidId, block, state, status, wall, wallRemaining, counted, seatBuys, nonSeatBuys,
bestBid, bestAsk, endBlock }`, integers as decimal strings.

## Run

```
pnpm install
DEPLOYMENT=../deployments/testnet.json pnpm start   # or VAULT=0x… ROUTER=0x…
pnpm test && pnpm typecheck
```

Env: `CHAIN` (`testnet` | `mainnet`), `RPC_WS`, `RPC_HTTP` (default to the public Monad endpoints),
`VAULT`, `ROUTER` or `DEPLOYMENT`, `PORT` (8787). See `.env.example`.
