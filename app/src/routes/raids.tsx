import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import { EmptyState, type EmptyScene } from '../components/empty'
import { Guide } from '../components/mascots'
import { useRaids } from '../lib/live'
import { isActive, phaseOf, sortLobby } from '../lib/phase'
import { BrickBackdrop, ErrorCard, RaidCard, useHead } from './index'

export const Route = createFileRoute('/raids')({ component: RaidBoard })

type Filter = 'all' | 'active' | 'victory' | 'held'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Live now' },
  { id: 'victory', label: 'Walls broken' },
  { id: 'held', label: 'Wall held' },
]
const EMPTY: Record<Filter, { scene: EmptyScene; title: string; body: string }> = {
  all: { scene: 'no-raids', title: 'No raids posted yet', body: 'When a sponsor puts up a wall, it shows up here. Demo raids post about every hour.' },
  active: { scene: 'no-live', title: 'Nothing live right now', body: 'The next demo raid opens about every hour. A toast pops up the moment it does, on any page.' },
  victory: { scene: 'no-wins', title: 'No walls broken yet', body: 'Be the crew that breaks the first one. Hit early, the end block is drawn at random.' },
  held: { scene: 'no-held', title: 'Every wall fell!', body: 'No raid here ended with the wall still standing. Keep it that way.' },
}
const PAGE = 12

/** Every raid on record, newest first, filterable, paged so the list can grow forever. */
function RaidBoard() {
  const raids = useRaids()
  const head = useHead()
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)
  const rows = (raids.data ? sortLobby(raids.data, head) : []).filter((r) => {
    const p = phaseOf(r, head)
    if (filter === 'active') return isActive(p)
    if (filter === 'victory') return p === 'victory'
    if (filter === 'held') return p === 'defeat' || p === 'called-off'
    return true
  })
  const wins = (raids.data ?? []).filter((r) => r.won).length

  return (
    <main className="flex min-h-dvh flex-col pt-28">
      <BrickBackdrop className="flex-1 pb-16 pt-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="title-outline -rotate-1 text-5xl sm:text-6xl">Raid board</h1>
              <p className="mt-2 text-grape-300">
                {raids.isLoading ? 'Loading raids…' : `${raids.data?.length ?? 0} raids on record · ${wins} walls broken`}
              </p>
            </div>
            <Guide who="bear" pose="watch" size="h-24">
              Tap any raid to replay the draw and see who counted.
            </Guide>
          </div>

          <div className="glass mt-6 inline-flex flex-wrap gap-1 rounded-full p-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => (setFilter(f.id), setShown(PAGE))} className={`relative rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${filter === f.id ? 'text-white' : 'text-white/75 hover:text-white'}`}>
                {filter === f.id && <motion.span layoutId="board-filter" className="absolute inset-0 -z-10 rounded-full bg-candy-500 shadow-[0_3px_0_#7a1f5f]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {raids.isError && <ErrorCard />}
            {!raids.isLoading && rows.length === 0 && (
              <EmptyState scene={EMPTY[filter].scene} title={EMPTY[filter].title} size="lg" action={filter !== 'all' ? <button className="btn btn-ghost px-5 py-2 text-sm" onClick={() => setFilter('all')}>Show all raids</button> : undefined}>
                {EMPTY[filter].body}
              </EmptyState>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.slice(0, shown).map((r, i) => (
                <motion.div key={r.raidId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                  <RaidCard raid={r} head={head} />
                </motion.div>
              ))}
            </div>
            {rows.length > shown && (
              <div className="mt-8 text-center">
                <button className="btn btn-ghost px-8 py-3" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              </div>
            )}
          </div>
        </div>
      </BrickBackdrop>
    </main>
  )
}
