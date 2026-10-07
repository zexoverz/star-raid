import { Link, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useConnection } from 'wagmi'
import { useOneTap } from '../lib/onetap'
import { useActions, useWalletKit } from '../lib/player'
import { play } from '../lib/sfx'
import { useNextRaid } from '../lib/schedule'
import { Mascot } from './mascots'
import { TokenIcon } from './token'

/**
 * First-time guide. Pops up when a wallet connects and is not raid-ready yet, and walks the three
 * steps in order: get a Star + tUSDC, set up the raid key, join a raid. Each step ticks itself off
 * from live state, so it always shows what to do next. Dismissed per wallet; reopen from "?".
 */
const seenKey = (a: string) => `starraid.guide.${a.toLowerCase()}`
const OPEN_EVENT = 'starraid:guide'
export const openGuide = () => window.dispatchEvent(new Event(OPEN_EVENT))

export function OnboardingGuide() {
  const { address, isConnected } = useConnection()
  const kit = useWalletKit()
  const one = useOneTap('0')
  const act = useActions()
  const next = useNextRaid()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = useState(false)

  const hasStar = kit.myStars.length > 0
  const hasUsdc = (kit.usdc ?? 0n) >= 5_000_000n || one.usdc > 0n
  const keyReady = one.ready
  const done = hasStar && hasUsdc && keyReady

  // Auto-open once per wallet when it connects and still has something to do.
  // (once per wallet per page load, so closing it never bounces it back open)
  const autoShown = useRef<string | null>(null)
  useEffect(() => {
    if (!isConnected || !address || kit.usdc === undefined || autoShown.current === address) return
    // Never pop over the page it would send you to: on /key you are already doing step 2.
    if (path === '/key') return
    autoShown.current = address
    if (!done && !localStorage.getItem(seenKey(address))) setOpen(true)
  }, [isConnected, address, kit.usdc, done, path])
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [])
  // Leaving to do a step (key page, a raid) hides the guide; it is still one click away.
  const lastPath = useRef(path)
  useEffect(() => {
    if (lastPath.current !== path) setOpen(false)
    lastPath.current = path
  }, [path])

  const close = () => {
    if (address) localStorage.setItem(seenKey(address), '1')
    setOpen(false)
  }
  const mint = () => act.getTestKit(!hasStar, !hasUsdc).then((ok) => ok && (kit.refetch(), play('coin')))
  const step = !hasStar || !hasUsdc ? 1 : !keyReady ? 2 : 3

  return (
    <AnimatePresence>
      {open && isConnected && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-grape-950/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            className="panel relative w-full max-w-lg overflow-visible p-6 pt-8"
            initial={{ y: 30, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Mascot who="fox" pose={done ? 'cheer' : 'think'} className="absolute -top-16 left-4 h-28 w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)]" />
            <button onClick={close} className="absolute right-4 top-3 text-lg text-grape-300 hover:text-white" aria-label="Close guide">
              ✕
            </button>
            <div className="pl-24">
              <div className="font-display text-2xl text-white">{done ? "You're raid-ready!" : 'How to raid'}</div>
              <p className="text-sm text-grape-300">{done ? 'Open a raid and tap HIT. No popups.' : 'Three steps, once. Then every raid is tap-to-hit.'}</p>
            </div>

            <ol className="mt-5 space-y-3">
              <Step n={1} active={step === 1} done={hasStar && hasUsdc} title="Get a Star and test tUSDC" body="A Lil Star is your seat. tUSDC is what you raid with. Both are free on testnet.">
                <button className="btn btn-candy px-4 py-2 text-sm" disabled={act.busy} onClick={mint}>
                  {!hasStar && <TokenIcon token="blindbox" size={16} />}
                  {!hasUsdc && <TokenIcon token="usdc" size={16} />}
                  {act.busy ? 'Confirm in your wallet…' : !hasStar && !hasUsdc ? 'Mint a Star + 50 tUSDC' : !hasStar ? 'Mint a Star' : 'Mint 50 tUSDC'}
                </button>
              </Step>
              <Step n={2} active={step === 2} done={keyReady} title="Set up your raid key (once)" body="Sign one seat pass and send some tUSDC + gas to a key that lives in this browser. It plays your Star for 7 days, in every raid.">
                <Link to="/key" className="btn btn-primary px-4 py-2 text-sm" onClick={() => address && localStorage.setItem(seenKey(address), '1')}>
                  🗝 Set up raid key
                </Link>
              </Step>
              <Step n={3} active={step === 3} done={false} title="Join a raid and tap HIT" body={next.liveRaid ? `Raid #${next.liveRaid.raidId} is open right now!` : `Next raid in about ${next.mmss || 'an hour'}. A toast pops up the moment it opens.`}>
                {next.liveRaid ? (
                  <Link to="/raid/$raidId" params={{ raidId: next.liveRaid.raidId }} className="btn btn-primary px-4 py-2 text-sm" onClick={close}>
                    ⚔ Jump in
                  </Link>
                ) : (
                  <Link to="/practice" className="btn btn-ghost px-4 py-2 text-sm" onClick={close}>
                    Warm up in practice
                  </Link>
                )}
              </Step>
            </ol>
            <button onClick={close} className="mt-5 w-full text-center text-xs text-grape-300 underline hover:text-white">
              {done ? 'Close' : "Got it, I'll do it later"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Step({ n, active, done, title, body, children }: { n: number; active: boolean; done: boolean; title: string; body: string; children?: React.ReactNode }) {
  return (
    <li className={`flex gap-3 rounded-2xl p-3 transition ${active ? 'bg-ember-500/15 ring-2 ring-ember-400' : 'bg-grape-950/50'} ${done ? 'opacity-70' : ''}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display ${done ? 'bg-mint text-grape-900' : active ? 'bg-ember-500 text-white' : 'bg-grape-700 text-grape-200'}`}>{done ? '✓' : n}</span>
      <div className="min-w-0 flex-1">
        <div className={`font-display ${done ? 'text-grape-200 line-through' : 'text-white'}`}>{title}</div>
        <p className="text-xs text-grape-300">{body}</p>
        {active && !done && children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  )
}
