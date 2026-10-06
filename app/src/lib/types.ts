// Mirror of live/src/frames.ts (wire format v1). Every frame is a full snapshot: replace, never merge.
export type FrameState = 'proposed' | 'finalized'
export type StatusName = 'None' | 'Posted' | 'Open' | 'Closing' | 'Closed' | 'Settled' | 'Aborted'
export type Hex = `0x${string}`

export interface FrameTerms {
  sponsor: Hex
  market: Hex
  base: Hex
  quote: Hex
  prizeToken: Hex
  baseDecimals: number
  quoteDecimals: number
  wallSize: string
  capPrice: string | null
  bounty: string
  target: string
  seatCap: string
  w0: string
  w1: string
  drawFrom: string
  hold: number
}

export interface FrameBuy {
  id: string
  tx: Hex
  block: string
  player: Hex
  seatKey: Hex | null
  kind: number | null
  holder: Hex | null
  tokenId: string | null
  baseOut: string
  quoteSpent: string
  wallFillQuote: string
  countedAdded: string
  afterEnd: boolean | null
}

export interface FrameSeat {
  seatKey: Hex
  kind: number
  player: Hex
  holder: Hex | null
  tokenId: string | null
  buys: number
  wallFillQuote: string
  counted: string
}

export interface Frame {
  v: 1
  raidId: string
  block: string
  state: FrameState
  status: StatusName
  terms: FrameTerms
  wall: 'active' | 'filled' | 'cancelled' | 'none'
  wallRemaining: string
  wallSold: string
  counted: string
  endBlock: string | null
  won: boolean | null
  settledAt?: number | null
  seatBuys: string
  nonSeatBuys: string
  totals: { quoteSpent: string; wallFillQuote: string }
  buys: FrameBuy[]
  seats: FrameSeat[]
}

/** `/raids` rows: the latest frame without buys and seats. */
export type LobbyRaid = Omit<Frame, 'buys' | 'seats'> & { buyCount: number; seatCount: number }

export interface RaidPair {
  proposed?: Frame
  finalized?: Frame
}
