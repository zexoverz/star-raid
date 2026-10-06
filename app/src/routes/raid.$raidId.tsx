import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useConnection } from 'wagmi'
import { Arena } from '../components/arena'
import { DrawCurtain } from '../components/curtain'
import { Panel, Sprite } from '../components/game'
import { JoinPanel } from '../components/join'
import { HitFeed, Party, Timeline } from '../components/raidparts'
import { LootPanel, Podium, ResultBanner } from '../components/results'
import { fmt, duration, short } from '../lib/format'
import { useRaidStream } from '../lib/live'
import { PHASE_LABEL, phaseOf } from '../lib/phase'
import { Guide } from '../components/mascots'
import { PhaseChip, useHead } from './index'

export const Route = createFileRoute('/raid/$raidId')({ component: RaidPage })

function RaidPage() {
  const { raidId } = Route.useParams()
  const { view, tentative, link, loading, missing } = useRaidStream(raidId)
  const head = useHead()
  const { address } = useConnection()
  const [replay, setReplay] = useState(0)

  if (loading || (!view && !missing))
    return (
      <main className="grid min-h-dvh place-items-center pt-24">
        <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
          <Sprite name="wall_boss" className="h-40 w-40" />
        </motion.div>
        <p className="font-display text-xl text-grape-300">Summoning raid #{raidId}…</p>
      </main>
    )
  if (!view)
    return (
      <main className="grid min-h-dvh place-items-center px-6 pt-24 text-center">
        <div>
          <Sprite name="defeat" className="mx-auto h-40 w-40" />
          <h1 className="title-outline mt-4 text-5xl">No raid #{raidId}</h1>
          <Link to="/" className="btn btn-primary mt-6">
            Back to the lobby
          </Link>
        </div>
      </main>
    )

  const phase = phaseOf(view, head)
  const t = view.terms
  const settled = phase === 'victory' || phase === 'defeat'

  return (
    <main className="relative pb-10 pt-24">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src="/art/raid_bg.webp" alt="" className="h-full w-full object-cover opacity-25 blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-b from-grape-950/60 to-grape-950" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="btn btn-ghost h-11 w-11 !p-0 text-xl" aria-label="Back to lobby">
              ←
            </Link>
            <div>
              <h1 className="title-outline -rotate-1 text-4xl sm:text-5xl">Raid #{raidId}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-grape-300">
                <PhaseChip phase={phase} />
                <span>sponsor {short(t.sponsor)}</span>
                <span>· prize {fmt(t.bounty, t.quoteDecimals)} tUSDC</span>
                <span>· hold {duration(t.hold)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`chip ${link === 'live' ? 'bg-mint/20 text-mint' : 'bg-candy-500/20 text-candy-300'}`}>
              <span className={`h-2 w-2 rounded-full ${link === 'live' ? 'bg-mint' : 'animate-pulse bg-candy-300'}`} />
              {link === 'live' ? 'live' : link}
            </span>
            <span className={`chip ${tentative ? 'bg-grape-700 text-grape-300' : 'bg-grape-700 text-white'}`} title="Proposed values show lighter until the block is finalized">
              {tentative ? 'proposed' : 'finalized'} · block {Number(view.block).toLocaleString()}
            </span>
          </div>
        </div>

        {phase === 'called-off' && (
          <Panel className="mb-6 flex items-center gap-4">
            <Sprite name="lock" className="h-20 w-20" />
            <div>
              <div className="title-outline-sm text-3xl">Raid called off</div>
              <p className="text-grape-300">It never opened (for example the start check failed or setup ran late). The sponsor's wall and prize went back in full and nobody could buy.</p>
            </div>
          </Panel>
        )}

        {(settled || phase === 'called-off') && (
          <div className="panel mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
            <Guide who="fox" size="h-16">
              This raid is over, so there is nothing to hit. Try the one-tap HIT pad in a practice raid while the next one is set up!
            </Guide>
            <Link to="/practice" className="btn btn-candy px-6 py-3">
              ⚡ Try one-tap
            </Link>
          </div>
        )}

        {settled && (
          <div className="mb-6 space-y-6">
            <ResultBanner frame={view} phase={phase} me={address} onReplay={() => setReplay((r) => r + 1)} />
            <LootPanel frame={view} phase={phase} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Arena frame={view} phase={phase} tentative={tentative} />
            <Timeline frame={view} head={head} phase={phase} />
            {settled && <Podium frame={view} />}
          </div>
          <aside className="space-y-6">
            {!settled && phase !== 'called-off' && <JoinPanel frame={view} phase={phase} />}
            {!settled && phase !== 'called-off' && <LootPanel frame={view} phase={phase} />}
            <Party frame={view} me={address} />
            <HitFeed frame={view} />
          </aside>
        </div>
        <p className="mt-6 text-center text-xs text-grape-300">
          {PHASE_LABEL[phase]} · every number on this page is read from Monad testnet through the live feed. No prices, no returns.
        </p>
      </div>

      <DrawCurtain frame={view} phase={phase} replay={replay} />
    </main>
  )
}
