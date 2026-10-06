import { QueryClient } from '@tanstack/react-query'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { monadTestnet } from 'viem/chains'
import { RPC_URL } from './config'

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: { [monadTestnet.id]: http(RPC_URL) },
})

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2_000, refetchOnWindowFocus: false } },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
