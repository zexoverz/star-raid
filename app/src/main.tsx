import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { Loader } from './components/loader'
import './index.css'
import { queryClient, wagmiConfig } from './lib/wagmi'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Loader>
          <RouterProvider router={router} />
        </Loader>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
