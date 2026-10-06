import { queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { LIVE_URL } from './config'
import { phaseOf } from './phase'
import { nextRaidAt } from './schedule'
import type { Frame, LobbyRaid, RaidPair } from './types'

export const raidsQuery = queryOptions({
  queryKey: ['raids'],
  queryFn: async (): Promise<LobbyRaid[]> => {
    const r = await fetch(`${LIVE_URL}/raids`)
    if (!r.ok) throw new Error(`live /raids ${r.status}`)
    return r.json()
  },
  // Poll every second around the expected start so the lobby flips to JOIN NOW without a gap,
  // otherwise every 5 s. This hits our live service, not the rate-limited RPC.
  refetchInterval: (q) => {
    const rows = q.state.data
    if (rows?.some((r) => ['live', 'danger', 'upcoming'].includes(phaseOf(r)))) return 5_000
    const at = nextRaidAt(rows)
    return at !== null && at - Date.now() < 60_000 ? 1_000 : 5_000
  },
})

export const raidQuery = (id: string) =>
  queryOptions({
    queryKey: ['raid', id],
    queryFn: async (): Promise<RaidPair> => {
      const r = await fetch(`${LIVE_URL}/raids/${id}`)
      if (r.status === 404) return {}
      if (!r.ok) throw new Error(`live /raids/${id} ${r.status}`)
      return r.json()
    },
  })

export const useRaids = () => useQuery(raidsQuery)

export const useHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: async () => (await fetch(`${LIVE_URL}/health`)).json() as Promise<{ ok: boolean; proposed: string; finalized: string }>,
    refetchInterval: 2_000,
  })

export type LinkState = 'connecting' | 'live' | 'reconnecting'

/**
 * Live raid stream. Keeps the latest proposed and the latest finalized frame, each replaced whole
 * (never merged). `view` is what the screen shows: the newer of the two, so proposed values appear
 * first (rendered tentative) and firm up when the finalized frame for that block lands.
 */
export function useRaidStream(id: string) {
  const initial = useQuery(raidQuery(id))
  const [pair, setPair] = useState<RaidPair>({})
  const [link, setLink] = useState<LinkState>('connecting')
  const seeded = useRef(false)

  useEffect(() => {
    if (initial.data && !seeded.current) {
      seeded.current = true
      setPair((p) => (p.proposed || p.finalized ? p : initial.data))
    }
  }, [initial.data])

  useEffect(() => {
    const es = new EventSource(`${LIVE_URL}/raids/${id}/stream`)
    es.onopen = () => setLink('live')
    es.onerror = () => setLink('reconnecting')
    es.addEventListener('frame', (e) => {
      const f = JSON.parse((e as MessageEvent).data) as Frame
      setLink('live')
      setPair((p) => (f.state === 'finalized' ? { ...p, finalized: f } : { ...p, proposed: f }))
    })
    return () => es.close()
  }, [id])

  const { proposed, finalized } = pair
  let view: Frame | undefined = finalized
  if (proposed && (!finalized || BigInt(proposed.block) > BigInt(finalized.block))) view = proposed
  const tentative = view !== undefined && view === proposed && view !== finalized

  return { view, finalized, tentative, link, loading: !view && initial.isLoading, missing: initial.isSuccess && !initial.data?.proposed && !initial.data?.finalized && !view }
}
