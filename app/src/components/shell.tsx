import { Link, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useHealth } from '../lib/live'
import { NextRaidChip } from './countdown'
import { MusicToggle, SoundToggle, WalletButton } from './wallet'

const LINKS: { to: NavTo; label: string }[] = [
  { to: '/', label: 'Lobby' },
  { to: '/raids', label: 'Raid board' },
  { to: '/key', label: 'Raid key' },
  { to: '/sponsor', label: 'Sponsor a raid' },
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
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3">
        <Link to="/" className="group flex shrink-0 items-center" aria-label="Star Raid home">
          {/* Wordmark in the Lil Stars logo style: crew silhouettes peeking over chunky sticker letters. */}
          <img src="/art/wordmark-h.svg" alt="Star Raid" className="hidden h-12 w-auto drop-shadow-[0_4px_0_#15122a] transition-transform group-hover:-rotate-1 group-hover:scale-105 sm:block" />
          <img src="/art/wordmark.svg" alt="Star Raid" className="-my-1 h-12 w-auto drop-shadow-[0_4px_0_#15122a] sm:hidden" />
        </Link>
        <nav className="glass hidden min-w-0 items-center gap-1 rounded-full px-2 py-1.5 xl:flex">
          {LINKS.filter((l) => ['/', '/raids'].includes(l.to)).map((l) => (
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
          <MusicToggle />
          <SoundToggle />
          <WalletButton />
          {/* phones use the bottom tab bar; the menu stays for tablets */}
          <button
            className="btn btn-ghost hidden h-11 w-11 !p-0 text-lg sm:inline-flex xl:hidden"
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

type NavTo = '/' | '/raids' | '/key' | '/sponsor' | '/how' | '/terms' | '/practice'

/**
 * Phones: a thumb-reach tab bar (game style) instead of the hamburger. Hidden on raid pages while a
 * HIT dock owns the bottom of the screen (the page sets data-hit-dock on <body>).
 */
export function TabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [path])
  const tabs: { to: NavTo; label: string; icon: string; match: (p: string) => boolean }[] = [
    { to: '/', label: 'Lobby', icon: 'lilstars/logo', match: (p) => p === '/' },
    { to: '/raids', label: 'Raids', icon: 'wall_boss', match: (p) => p === '/raids' || p.startsWith('/raid/') },
    { to: '/practice', label: 'Practice', icon: 'hit_spark', match: (p) => p === '/practice' },
    { to: '/key', label: 'My key', icon: 'seat_ticket', match: (p) => p === '/key' },
  ]
  const moreActive = ['/sponsor', '/how', '/terms'].includes(path)
  return (
    <>
      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-40 bg-grape-950/60 backdrop-blur-[2px] sm:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.nav
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="glass absolute inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex flex-col gap-1 rounded-3xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { to: '/sponsor' as const, label: 'Sponsor a raid', icon: 'flag_sponsor' },
                { to: '/how' as const, label: 'How it works', icon: 'dice_block' },
                { to: '/terms' as const, label: 'Terms', icon: 'shield' },
              ].map((it) => (
                <Link key={it.to} to={it.to} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold ${path === it.to ? 'bg-ember-500 text-white shadow-[0_3px_0_#b4470a]' : 'text-white/90 active:bg-white/10'}`}>
                  <img src={`/art/${it.icon}.webp`} alt="" className="h-8 w-8 object-contain" draggable={false} />
                  {it.label}
                </Link>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
      <nav className="tabbar fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:hidden" aria-label="Main">
        <div className="mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[26px] border-[3px] border-grape-500 bg-grape-900/95 p-1 shadow-[0_6px_0_#15122a,0_-6px_24px_rgba(0,0,0,0.35)] backdrop-blur">
          {tabs.map((t) => {
            const on = t.match(path)
            return (
              <Link key={t.to} to={t.to} className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[12px] font-extrabold tracking-wide ${on ? 'text-white' : 'text-grape-300'}`}>
                {on && <motion.span layoutId="tab-pill" className="absolute inset-0 -z-10 rounded-[20px] bg-ember-500 shadow-[0_3px_0_#b4470a]" transition={{ type: 'spring', stiffness: 460, damping: 34 }} />}
                <motion.img src={`/art/${t.icon}.webp`} alt="" className="h-7 w-7 object-contain" animate={on ? { y: [0, -4, 0], rotate: [0, -6, 0] } : { y: 0 }} transition={{ duration: 0.4 }} draggable={false} />
                {t.label}
              </Link>
            )
          })}
          <button onClick={() => setMore((m) => !m)} aria-expanded={more} className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[12px] font-extrabold tracking-wide ${moreActive || more ? 'text-white' : 'text-grape-300'}`}>
            {moreActive && <span className="absolute inset-0 -z-10 rounded-[20px] bg-ember-500 shadow-[0_3px_0_#b4470a]" />}
            <span className="grid h-7 w-7 place-items-center text-xl leading-none">{more ? '✕' : '⋯'}</span>
            More
          </button>
        </div>
      </nav>
    </>
  )
}

/** How it works and Terms live under one small dropdown, so the pill nav stays short. */
function MoreMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  const active = path === '/sponsor' || path === '/practice' || path === '/how' || path === '/terms'
  const items = [
    { to: '/sponsor' as const, label: 'Sponsor a raid', icon: 'flag_sponsor' },
    { to: '/practice' as const, label: 'Practice', icon: 'dice_block' },
    { to: '/how' as const, label: 'How it works', icon: 'hit_spark' },
    { to: '/terms' as const, label: 'Terms', icon: 'seat_ticket' },
  ]
  // Hover opens it on desktop; a click right after that hover must not close it again.
  const hoveredAt = useRef(0)
  return (
    <div
      className="relative"
      onMouseEnter={() => ((hoveredAt.current = Date.now()), setOpen(true))}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => (Date.now() - hoveredAt.current < 400 ? true : !o))}
        aria-expanded={open}
        className={`relative flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold tracking-wide outline-none transition-colors ${active ? 'text-white' : open ? 'text-white' : 'text-white/80 hover:text-white'}`}
      >
        {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-ember-500 shadow-[0_3px_0_#b4470a]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
        {!active && open && <span className="absolute inset-0 -z-10 rounded-full bg-white/10" />}
        More
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-[12px] sm:text-[10px] leading-none">▼</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3"
          >
            {/* same glass as the nav pill, with a little notch pointing at "More" */}
            <div className="glass relative flex w-52 flex-col gap-1 rounded-3xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <span className="absolute -top-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm border-l-[3px] border-t-[3px] border-grape-500 bg-[rgb(102_93_150)]" />
              {items.map((it) => (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`relative flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-bold outline-none transition-colors ${path === it.to ? 'bg-ember-500 text-white shadow-[0_3px_0_#b4470a]' : 'text-white/85 hover:bg-white/15 hover:text-white'}`}
                >
                  <img src={`/art/${it.icon}.webp`} alt="" className="h-6 w-6 object-contain" draggable={false} />
                  {it.label}
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
    <footer className="relative z-10 mt-16 border-t-4 border-grape-800 bg-[#1A1D24] pb-24 sm:pb-0">
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
