import { useCallback, useEffect, useRef, useState } from 'react'
import type { Frame, FrameBuy, FrameSeat, Hex } from './types'

/**
 * Practice raid: a local simulation so the one-tap flow can be played while no raid is live on
 * testnet. Nothing here touches the chain, and every screen that shows it carries a "Practice"
 * banner. Numbers are invented by this file only and are never shown as real (AGENTS rule 13).
 */
const BLOCK_MS = 400
const WINDOW = 120n
const DEC = 6
const u = (n: number) => BigInt(Math.round(n * 10 ** DEC))
const OTHERS: { tokenId: string; player: Hex }[] = [
  { tokenId: '12', player: '0x1111111111111111111111111111111111111111' },
  { tokenId: '42', player: '0x2222222222222222222222222222222222222222' },
  { tokenId: '300', player: '0x3333333333333333333333333333333333333333' },
  { tokenId: '88', player: '0x4444444444444444444444444444444444444444' },
]
export const ME: Hex = '0x00000000000000000000000000000000000000a1'
export const MY_STAR = '7'

export function useSimRaid() {
  const start = useRef(0n)
  const [head, setHead] = useState(0n)
  const [buys, setBuys] = useState<FrameBuy[]>([])
  const [endBlock, setEnd] = useState<bigint | null>(null)
  const [settled, setSettled] = useState<number | null>(null)
  const [run, setRun] = useState(0)

  const w0 = start.current + 15n
  const w1 = w0 + WINDOW
  const drawFrom = w1 - WINDOW / 4n
  const target = u(400)
  const seatCap = u(200)

  // chain clock
  useEffect(() => {
    start.current = 1_000_000n
    setHead(start.current)
    setBuys([])
    setEnd(null)
    setSettled(null)
    const i = setInterval(() => setHead((h) => h + 1n), BLOCK_MS)
    return () => clearInterval(i)
  }, [run])

  const addBuy = useCallback(
    (player: Hex, tokenId: string | null, amount: bigint, block: bigint) =>
      setBuys((bs) => {
        const seatKey = tokenId ? (`0x${tokenId.padStart(64, '0')}` as Hex) : null
        const prev = seatKey ? bs.filter((b) => b.seatKey === seatKey).reduce((a, b) => a + BigInt(b.countedAdded), 0n) : 0n
        const room = seatCap - prev
        const counted = seatKey ? (amount < room ? amount : room > 0n ? room : 0n) : 0n
        const id = `sim-${bs.length}-${block}`
        return [...bs, { id, tx: `0x${'0'.repeat(64)}` as Hex, block: block.toString(), player, seatKey, kind: seatKey ? 1 : null, holder: seatKey ? player : null, tokenId, baseOut: (amount * 10n ** 12n * 38n).toString(), quoteSpent: amount.toString(), wallFillQuote: amount.toString(), countedAdded: counted.toString(), afterEnd: null }]
      }),
    [seatCap],
  )

  // other raiders and a no-seat wallet
  useEffect(() => {
    if (head < w0 || head > w1) return
    if (head % 6n === 0n) {
      const o = OTHERS[Number((head / 6n) % BigInt(OTHERS.length))]
      addBuy(o.player, o.tokenId, u(10 + Number(head % 4n) * 5), head)
    }
    if (head === w0 + 40n) addBuy('0x9999999999999999999999999999999999999999', null, u(15), head)
  }, [head, w0, w1, addBuy])

  // draw and settle
  useEffect(() => {
    if (head === w1 + 8n) setEnd(drawFrom + ((head * 7n) % (w1 - drawFrom + 1n)))
    if (head === w1 + 16n) setSettled(Math.floor(Date.now() / 1000))
  }, [head, w1, drawFrom])

  const tap = useCallback(async (amount: bigint) => {
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 400))
    setHead((h) => {
      addBuy(ME, MY_STAR, amount, h)
      return h
    })
    return '0xsim' as Hex
  }, [addBuy])

  const withEnd = buys.map((b) => ({ ...b, afterEnd: endBlock === null ? null : BigInt(b.block) > endBlock }))
  const countedOf = (b: FrameBuy) => (endBlock === null || BigInt(b.block) <= endBlock ? BigInt(b.countedAdded) : 0n)
  const counted = withEnd.reduce((a, b) => a + countedOf(b), 0n)
  const seatMap = new Map<string, FrameSeat>()
  for (const b of withEnd) {
    if (!b.seatKey) continue
    const s = seatMap.get(b.seatKey) ?? { seatKey: b.seatKey, kind: 1, player: b.player, holder: b.player, tokenId: b.tokenId, buys: 0, wallFillQuote: '0', counted: '0' }
    s.buys++
    s.wallFillQuote = (BigInt(s.wallFillQuote) + BigInt(b.wallFillQuote)).toString()
    s.counted = (BigInt(s.counted) + countedOf(b)).toString()
    seatMap.set(b.seatKey, s)
  }
  const seats = [...seatMap.values()].sort((a, b) => (BigInt(b.counted) > BigInt(a.counted) ? 1 : -1))
  const spent = withEnd.reduce((a, b) => a + BigInt(b.quoteSpent), 0n)
  const wallSize = 100_000n * 10n ** 18n
  const sold = (spent * 10n ** 12n * 38n) > wallSize ? wallSize : spent * 10n ** 12n * 38n
  const status: Frame['status'] = settled ? 'Settled' : endBlock !== null ? 'Closed' : head > w1 ? 'Closing' : head >= w0 - 10n ? 'Open' : 'Posted'

  const view: Frame | undefined = head === 0n ? undefined : {
    v: 1,
    raidId: 'practice',
    block: head.toString(),
    state: 'finalized',
    status,
    terms: { sponsor: '0x5555555555555555555555555555555555555555', market: ME, base: ME, quote: ME, prizeToken: ME, baseDecimals: 18, quoteDecimals: DEC, wallSize: wallSize.toString(), capPrice: '26000', bounty: u(50).toString(), target: target.toString(), seatCap: seatCap.toString(), w0: w0.toString(), w1: w1.toString(), drawFrom: drawFrom.toString(), hold: 30 },
    wall: status === 'Posted' ? 'none' : status === 'Settled' ? 'cancelled' : 'active',
    wallRemaining: (wallSize - sold).toString(),
    wallSold: sold.toString(),
    counted: counted.toString(),
    endBlock: endBlock?.toString() ?? null,
    won: settled ? counted >= target : null,
    settledAt: settled,
    seatBuys: withEnd.filter((b) => b.seatKey).length.toString(),
    nonSeatBuys: withEnd.filter((b) => !b.seatKey).length.toString(),
    totals: { quoteSpent: spent.toString(), wallFillQuote: spent.toString() },
    buys: withEnd,
    seats,
  }

  return { view, head, tap, restart: () => setRun((r) => r + 1) }
}
