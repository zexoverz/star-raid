import { useEffect, useState } from 'react'
import { useRaids } from './live'
import { phaseOf } from './phase'
import type { LobbyRaid } from './types'

/**
 * When the next testnet demo raid should appear. The keeper posts one every DEMO_EVERY_MIN (60) once
 * nothing is in flight, so the next post is about an hour after the last one. This is a schedule
 * estimate, not a chain value, and every place that shows it says "about".
 */
const DEMO_EVERY_MS = 60 * 60 * 1000
const POST_TO_SETTLE_MS = 90_000 // a demo raid settles ~90 s after it is posted

export function nextRaidAt(rows: LobbyRaid[] | undefined): number | null {
  const last = rows?.find((r) => r.settledAt)
  return last?.settledAt ? last.settledAt * 1000 - POST_TO_SETTLE_MS + DEMO_EVERY_MS : null
}

export function useNextRaid() {
  const raids = useRaids()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  const rows = raids.data
  const liveRaid = rows?.find((r) => {
    const p = phaseOf(r)
    return p === 'live' || p === 'danger' || p === 'upcoming'
  })
  const at = nextRaidAt(rows)
  const left = at === null ? null : Math.max(0, Math.round((at - now) / 1000))
  const clock = at === null ? null : new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const mmss = left === null ? '' : left >= 3600 ? `${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return { liveRaid, at, left, clock, mmss, due: left === 0 }
}
