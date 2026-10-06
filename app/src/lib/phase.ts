import { BLOCK_MS } from './config'
import type { Frame, LobbyRaid } from './types'

export type Phase =
  | 'upcoming' // posted, the window has not started
  | 'live' // open, before the draw zone
  | 'danger' // open, inside [drawFrom, w1]: the end can land on any of these blocks
  | 'drawing' // window over, waiting for Pyth Entropy
  | 'revealed' // end block known, settle pending
  | 'victory'
  | 'defeat'
  | 'called-off' // aborted or expired: everyone refunded

export function phaseOf(f: Pick<Frame, 'status' | 'terms' | 'won' | 'endBlock'>, head?: bigint): Phase {
  const w0 = BigInt(f.terms.w0)
  const w1 = BigInt(f.terms.w1)
  const from = BigInt(f.terms.drawFrom)
  switch (f.status) {
    case 'Aborted':
    case 'None':
      return 'called-off'
    case 'Settled':
      return f.won ? 'victory' : 'defeat'
    case 'Closed':
      return 'revealed'
    case 'Closing':
      return 'drawing'
    case 'Posted':
      if (head !== undefined && head > w1) return 'called-off'
      return 'upcoming'
    case 'Open':
      if (head === undefined) return 'live'
      if (head < w0) return 'upcoming'
      if (head > w1) return 'drawing'
      if (head >= from) return 'danger'
      return 'live'
  }
}

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: 'Gathering',
  live: 'Raid live',
  danger: 'Danger zone',
  drawing: 'Drawing the end',
  revealed: 'End revealed',
  victory: 'Victory',
  defeat: 'Wall held',
  'called-off': 'Called off',
}

export const isActive = (p: Phase) => p === 'upcoming' || p === 'live' || p === 'danger' || p === 'drawing' || p === 'revealed'

/** Rough seconds for a block distance. Shown with a "~" because block time varies. */
export const blocksToSec = (blocks: bigint) => Number(blocks) * (BLOCK_MS / 1000)

export function sortLobby(rows: LobbyRaid[], head?: bigint) {
  const rank = (r: LobbyRaid) => {
    const p = phaseOf(r, head)
    return p === 'live' || p === 'danger' ? 0 : p === 'upcoming' ? 1 : p === 'drawing' || p === 'revealed' ? 2 : 3
  }
  return [...rows].sort((a, b) => rank(a) - rank(b) || Number(BigInt(b.raidId) - BigInt(a.raidId)))
}
