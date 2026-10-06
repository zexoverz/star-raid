import { Link } from '@tanstack/react-router'
import { useHealth } from '../lib/live'
import { NextRaidChip } from './countdown'
import { SoundToggle, WalletButton } from './wallet'

export function TopBar() {
  const health = useHealth()
  const ok = health.data?.ok
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link to="/" className="group flex items-center gap-2">
          <img src="/art/coin.webp" alt="" className="h-11 w-11 drop-shadow-[0_3px_0_#2d2250] transition-transform group-hover:rotate-12" />
          <span className="title-outline-sm text-2xl leading-none sm:text-3xl">
            Star <span className="text-ember-400">Raid</span>
          </span>
        </Link>
        <nav className="glass hidden items-center gap-1 rounded-full px-2 py-1.5 md:flex">
          <NavLink to="/">Lobby</NavLink>
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/how">How it works</NavLink>
          <NavLink to="/terms">Terms</NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <NextRaidChip />
          <span
            className="chip hidden bg-grape-900/80 text-grape-100 sm:inline-flex"
            title={ok ? `Live feed at block ${health.data?.finalized}` : 'Live feed unreachable'}
          >
            <span className={`h-2 w-2 rounded-full ${ok ? 'bg-mint shadow-[0_0_8px_#a3e3c1]' : 'bg-candy-500'}`} />
            {ok ? `Block ${Number(health.data?.finalized).toLocaleString()}` : 'Offline'}
          </span>
          <SoundToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  )
}

function NavLink({ to, children }: { to: '/' | '/how' | '/terms' | '/practice'; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-1.5 text-sm font-bold tracking-wide text-white/85 transition hover:text-white"
      activeProps={{ className: 'bg-ember-500 text-white shadow-[0_3px_0_#b4470a]' }}
      activeOptions={{ exact: true }}
    >
      {children}
    </Link>
  )
}

export function Footer() {
  return (
    <footer className="relative z-10 mt-16 border-t-4 border-grape-800 bg-[#1A1D24]">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-8 text-center text-sm text-grape-300 sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <img src="/art/lilstars/logo.webp" alt="Lil Stars" className="h-14 w-14" />
          <p className="max-w-md">
            Lil Stars characters are the creation of the{' '}
            <a className="font-bold text-candy-300 underline" href="https://lilstars.xyz" target="_blank" rel="noreferrer">
              Lil Stars team
            </a>
            . Raid poses and outfits are Star Raid event art made from their designs. Testnet seats show preview art from the collection.
          </p>
        </div>
        <p className="max-w-sm">Monad testnet. Orders on Kuru's on-chain book. End block drawn by Pyth Entropy. No prices, no returns: only what the chain shows.</p>
      </div>
    </footer>
  )
}
