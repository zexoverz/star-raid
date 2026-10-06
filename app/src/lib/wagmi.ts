import { QueryClient } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { fallback, http } from 'viem'
import { monadTestnet } from 'viem/chains'
import { RPC_URL } from './config'

/// Reown AppKit project id (same one as KERB), from VITE_REOWN_PROJECT_ID. Injected wallets work
/// without it; WalletConnect (every mobile visitor) needs it, and a placeholder id is refused 403.
const PLACEHOLDER_PROJECT_ID = '00000000000000000000000000000000'
const configured = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined
if (!configured) console.warn('VITE_REOWN_PROJECT_ID is not set: WalletConnect will not work. Injected wallets are unaffected.')
const projectId = configured || PLACEHOLDER_PROJECT_ID

const networks = [monadTestnet as AppKitNetwork] as [AppKitNetwork, ...AppKitNetwork[]]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  // fallback([ours]) keeps AppKit from adding its own WalletConnect RPC leg, so every read goes to
  // our RPC (the batching client in onetap/player is separate and unchanged).
  transports: { [monadTestnet.id]: fallback([http(RPC_URL)]) },
})

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: monadTestnet as AppKitNetwork,
  projectId,
  metadata: {
    name: 'Star Raid',
    description: 'Lil Stars raid together on Kuru',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://web-production-de387e.up.railway.app',
    icons: [],
  },
  themeMode: 'dark',
  themeVariables: { '--w3m-accent': '#ff8c42', '--w3m-border-radius-master': '4px', '--w3m-z-index': 1000 },
  features: { analytics: false, email: false, socials: false },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2_000, refetchOnWindowFocus: false } },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
