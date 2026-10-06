import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { parseUnits } from 'viem'
import { Arena } from '../components/arena'
import { DrawCurtain } from '../components/curtain'
import { FloatingHit, HitPad } from '../components/hitpad'
import { Guide } from '../components/mascots'
import { HitFeed, Party, Timeline } from '../components/raidparts'
import { Podium, ResultBanner } from '../components/results'
import { phaseOf } from '../lib/phase'
import { ME, MY_STAR, useSimRaid } from '../lib/sim'

export const Route = createFileRoute('/practice')({ component: Practice })

/** A local practice raid: the full game loop with the one-tap pad, nothing sent on chain. */
function Practice() {
  const sim = useSimRaid()
  const [replay, setReplay] = useState(0)
  const [hits, setHits] = useState(0)
  const [inflight, setInflight] = useState(0)
  const [amount, setAmount] = useState(parseUnits('5', 6))
  const spent = useRef(0n)
  const budget = parseUnits('50', 6)
  const view = sim.view
  if (!view) return <main className="min-h-dvh pt-24" />
  const phase = phaseOf(view, sim.head)
  const open = phase === 'live' || phase === 'danger'
  const settled = phase === 'victory' || phase === 'defeat'
  const hitOnce = async (a: bigint) => {
    if (budget - spent.current < a) return
    spent.current += a
    setInflight((n) => n + 1)
    await sim.tap(a)
    setInflight((n) => n - 1)
    setHits((h) => h + 1)
  }

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
            <h1 className="title-outline -rotate-1 text-4xl sm:text-5xl">Practice raid</h1>
          </div>
          <span className="chip bg-candy-500 text-white">Practice · nothing is sent on chain</span>
        </div>

        {settled && (
          <div className="mb-6">
            <ResultBanner frame={view} phase={phase} shareable={false} onReplay={() => setReplay((r) => r + 1)} />
            <div className="mt-4 flex justify-center">
              <button className="btn btn-primary px-8 py-3 text-xl" onClick={() => (sim.restart(), setHits(0), (spent.current = 0n))}>
                ↻ Play again
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Arena frame={view} phase={phase} tentative={false} />
            <Timeline frame={view} head={sim.head} phase={phase} />
            {settled && <Podium frame={view} shareable={false} />}
          </div>
          <aside className="space-y-6">
            <div className="panel p-5">
              <HitPad
                tokenId={MY_STAR}
                decimals={6}
                balance={budget - spent.current}
                open={open}
                label={open ? '⚔ HIT!' : phase === 'upcoming' ? 'Get ready…' : 'Window closed'}
                hits={hits}
                inflight={inflight}
                onAmount={setAmount}
                onHit={hitOnce}
                footer={
                  <div className="mt-4 border-t border-grape-700 pt-3">
                    <Guide who="fox" pose={open ? 'attack' : 'think'} size="h-20">
                      {phase === 'upcoming' ? 'This is a practice run. Get your finger ready!' : open ? 'Tap HIT! In a real raid, each tap is one on-chain buy with no wallet popup.' : 'Practice over. In a real raid you set up one-tap once, then just tap.'}
                    </Guide>
                  </div>
                }
              />
            </div>
            <Party frame={view} me={ME} />
            <HitFeed frame={view} />
          </aside>
        </div>
      </div>
      <FloatingHit open={open && budget - spent.current >= amount} amount={amount} onHit={hitOnce} />
      <DrawCurtain frame={view} phase={phase} replay={replay} />
    </main>
  )
}
