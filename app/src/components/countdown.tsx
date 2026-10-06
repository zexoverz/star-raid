import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useNextRaid } from '../lib/schedule'

/** Big "next raid" countdown for the hero. Turns into a JOIN NOW button while a raid is live. */
export function NextRaidCountdown() {
  const n = useNextRaid()
  if (n.liveRaid)
    return (
      <Link to="/raid/$raidId" params={{ raidId: n.liveRaid.raidId }} className="glass group flex items-center gap-4 rounded-3xl px-5 py-3">
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-ember-500" />
        </span>
        <div className="text-left">
          <div className="text-xs font-bold uppercase tracking-widest text-ember-300">Raid #{n.liveRaid.raidId} is live</div>
          <div className="title-outline-sm text-3xl group-hover:text-ember-300">⚔ Join now</div>
        </div>
      </Link>
    )
  if (n.at === null) return null
  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass flex items-center gap-4 rounded-3xl px-5 py-3">
      <div className="text-left">
        <div className="text-xs font-bold uppercase tracking-widest text-cream-200">Next raid starts</div>
        <div className="text-sm text-white">
          {n.due ? 'any moment now' : <>about <b className="text-ember-300">{n.clock}</b> your time</>}
        </div>
      </div>
      <div className={`font-display text-5xl tabular-nums ${n.due ? 'animate-pulse text-candy-300' : 'text-ember-400'}`}>{n.due ? 'SOON' : n.mmss}</div>
    </motion.div>
  )
}

/** Compact chip for the top bar. */
export function NextRaidChip() {
  const n = useNextRaid()
  if (n.liveRaid)
    return (
      <Link to="/raid/$raidId" params={{ raidId: n.liveRaid.raidId }} className="chip animate-pulse bg-ember-500 text-white shadow-[0_0_12px_#ff8c42]">
        ⚔ Raid #{n.liveRaid.raidId} live
      </Link>
    )
  if (n.at === null) return null
  return (
    <span className="chip hidden bg-grape-900/80 text-cream-100 lg:inline-flex" title={`Next demo raid at about ${n.clock} (estimate)`}>
      ⏳ next raid {n.due ? 'soon' : n.mmss}
    </span>
  )
}
