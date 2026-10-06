# Star Raid app

The frontend for Star Raid: Vite, React, Tailwind v4, TanStack Router and Query, wagmi and viem.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build
```

Config (`.env.example`): `VITE_LIVE_URL` (the `live/` SSE service) and `VITE_RPC_URL` (Monad testnet).
Contract addresses and ABIs come from `../deployments`.

Routes: `/` lobby, `/raid/:id` live raid, draw and results, `/practice` one-tap practice (local only,
nothing sent on chain), `/how`, `/terms`.

Deployed on Railway service `web`, rebuilt on every push to `main` that touches `app/` or
`deployments/` (`app/Dockerfile`, Caddy). See `docs/plan/decisions.md` D35 to D37.

Lil Stars characters are the creation of the Lil Stars team (https://lilstars.xyz). Raid poses and the
hero scene are Star Raid event art made from their designs (D35).
