import { Link, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useHealth } from '../lib/live'
import { NextRaidChip } from './countdown'
import { SoundToggle, WalletButton } from './wallet'

const LINKS: { to: NavTo; label: string }[] = [
  { to: '/', label: 'Lobby' },
  { to: '/raids', label: 'Raid board' },
  { to: '/key', label: 'Raid key' },
  { to: '/practice', label: 'Practice' },
  { to: '/how', label: 'How it works' },
  { to: '/terms', label: 'Terms' },
]

/**
 * The bar never overlaps: logo and the right-hand group never shrink, and the pill nav only shows
 * from xl (where everything fits with a connected wallet). Below that it folds into a menu button.
 */
export function TopBar() {
  const health = useHealth()
  const ok = health.data?.ok
  const [open, setOpen] = useState(false)
  const path = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => setOpen(false), [path])
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link to="/" className="group flex shrink-0 items-center gap-2">
          <img src="/art/logo.svg" alt="Star Raid" className="h-12 w-12 drop-shadow-[0_3px_0_#2d2250] transition-transform group-hover:-rotate-6 group-hover:scale-110" />
          <span className="title-outline-sm hidden whitespace-nowrap text-2xl leading-none sm:inline sm:text-3xl">
            Star <span className="text-ember-400">Raid</span>
          </span>
        </Link>
        <nav className="glass hidden min-w-0 items-center gap-1 rounded-full px-2 py-1.5 xl:flex">
          {LINKS.filter((l) => ['/', '/raids', '/practice'].includes(l.to)).map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
          <MoreMenu path={path} />
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <NextRaidChip />
          <span
            className="chip hidden whitespace-nowrap bg-grape-900/80 text-grape-100 2xl:inline-flex"
            title={ok ? `Live feed at block ${health.data?.finalized}` : 'Live feed unreachable'}
          >
            <span className={`h-2 w-2 rounded-full ${ok ? 'bg-mint shadow-[0_0_8px_#a3e3c1]' : 'bg-candy-500'}`} />
            {ok ? `Block ${Number(health.data?.finalized).toLocaleString()}` : 'Offline'}
          </span>
          <SoundToggle />
          <WalletButton />
          <button
            className="btn btn-ghost h-10 w-10 !p-0 text-lg xl:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="glass mx-auto mt-2 flex max-w-7xl flex-col gap-1 rounded-3xl p-2 xl:hidden"
          >
            {LINKS.map((l) => {
              const active = l.to === '/' ? path === '/' : path === l.to || (l.to === '/raids' && path.startsWith('/raid/'))
              return (
                <Link key={l.to} to={l.to} className={`rounded-2xl px-4 py-2.5 font-bold ${active ? 'bg-ember-500 text-white shadow-[0_3px_0_#b4470a]' : 'text-white/85 hover:bg-white/10'}`}>
                  {l.label}
                </Link>
              )
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

type NavTo = '/' | '/raids' | '/key' | '/how' | '/terms' | '/practice'

/** How it works and Terms live under one small dropdown, so the pill nav stays short. */
function MoreMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  const active = path === '/how' || path === '/terms'
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold tracking-wide ${active ? 'text-white' : 'text-white/80 hover:text-white'}`}>
        {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-ember-500 shadow-[0_3px_0_#b4470a]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
        More ▾
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-full pt-2">
            <div className="panel flex w-44 flex-col p-1.5">
              {(['/how', '/terms'] as const).map((to) => (
                <Link key={to} to={to} className={`rounded-xl px-3 py-2 text-sm font-bold ${path === to ? 'bg-ember-500 text-white' : 'text-white/85 hover:bg-white/10'}`}>
                  {to === '/how' ? 'How it works' : 'Terms'}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The active pill is one shared element that glides between links (motion layoutId). */
function NavLink({ to, children }: { to: NavTo; children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const active = to === '/' ? path === '/' : path === to || (to === '/raids' && path.startsWith('/raid/'))
  return (
    <Link to={to} className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold tracking-wide transition-colors ${active ? 'text-white' : 'text-white/80 hover:text-white'}`}>
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 -z-10 rounded-full bg-ember-500 shadow-[0_3px_0_#b4470a]"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        />
      )}
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
