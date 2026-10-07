import { useEffect, useState } from 'react'
import { useHealth, useRaids } from './live'
import { phaseOf } from './phase'
import type { LobbyRaid } from './types'

/**
 * When the next testnet demo raid should appear. The keeper posts one every DEMO_EVERY_MIN (60) once
 * nothing is in flight, so the next post is about an hour after the last one. This is a schedule
 * estimate, not a chain value, and every place that shows it says "about".
 */
const DEMO_EVERY_MS = 60 * 60 * 1000
const POST_TO_SETTLE_MS = 90_000 // a demo raid settles ~90 s after it is posted
const LATE_GRACE_MS = 3 * 60_000 // show "soon" this long past the estimate before rolling to the next slot

export function nextRaidAt(rows: LobbyRaid[] | undefined): number | null {
  const last = rows?.find((r) => r.settledAt)
  return last?.settledAt ? last.settledAt * 1000 - POST_TO_SETTLE_MS + DEMO_EVERY_MS : null
}

/** A missed slot moves the estimate on by whole hours once it is LATE_GRACE_MS overdue. */
export function rollForward(at: number | null, now: number): number | null {
  if (at === null) return null
  while (now - at > LATE_GRACE_MS) at += DEMO_EVERY_MS
  return at
}

export function useNextRaid() {
  const raids = useRaids()
  const health = useHealth()
  const head = health.data?.proposed ? BigInt(health.data.proposed) : undefined
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  const rows = raids.data
  // Needs the chain head: a raid left at Posted after its window (the keeper never opened it) is called off.
  const liveRaid = head === undefined ? undefined : rows?.find((r) => {
    const p = phaseOf(r, head)
    return p === 'live' || p === 'danger' || p === 'upcoming'
  })
  let at = nextRaidAt(rows)
  // If the keeper skipped a slot, roll the estimate to the next hour instead of sitting on "soon".
  at = rollForward(at, now)
  const left = at === null ? null : Math.max(0, Math.round((at - now) / 1000))
  const clock = at === null ? null : new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const mmss = left === null ? '' : left >= 3600 ? `${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return { liveRaid, at, left, clock, mmss, due: left === 0 }
}

/**
 * Mounted once in the root layout: when a raid newly appears as gathering or live, pop a toast with
 * a link, so nobody has to reload. Skips raids already live when the page loaded.
 */
export function useRaidAlerts(onNew: (raidId: string) => void) {
  const raids = useRaids()
  const health = useHealth()
  const head = health.data?.proposed ? BigInt(health.data.proposed) : undefined
  const [seen] = useState(() => new Set<string>())
  const [primed, setPrimed] = useState(false)
  useEffect(() => {
    const rows = raids.data
    if (!rows || head === undefined) return
    for (const r of rows) {
      const p = phaseOf(r, head)
      if ((p === 'upcoming' || p === 'live' || p === 'danger') && !seen.has(r.raidId)) {
        seen.add(r.raidId)
        if (primed) onNew(r.raidId)
      }
    }
    if (!primed) setPrimed(true)
  }, [raids.data, head, primed, seen, onNew])
}
