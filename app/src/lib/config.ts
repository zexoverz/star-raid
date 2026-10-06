import deployment from '../../../deployments/testnet.json'

export const LIVE_URL: string = import.meta.env.VITE_LIVE_URL ?? 'https://live-production-e50b.up.railway.app'
export const RPC_URL: string = import.meta.env.VITE_RPC_URL ?? 'https://testnet-rpc.monad.xyz'

export const CHAIN_ID = deployment.chainId as 10143

export const ADDR = {
  vault: deployment.vault as `0x${string}`,
  router: deployment.router as `0x${string}`,
  seatGate: deployment.seatGate as `0x${string}`,
  lilStars: deployment.lilStars as `0x${string}`,
  quote: deployment.quoteToken as `0x${string}`,
  base: deployment.baseToken as `0x${string}`,
  market: deployment.market as `0x${string}`,
}

export const EXPLORER = 'https://testnet.monadexplorer.com'
/** Monad testnet blocks are ~400 ms. Used only to turn block distances into rough seconds. */
export const BLOCK_MS = 400
