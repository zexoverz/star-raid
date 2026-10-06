import { formatUnits } from 'viem'

/** Token amount (integer string) to a short human number. Never a price, never PnL. */
export function fmt(units: string | bigint | null | undefined, decimals: number, maxFrac = 2): string {
  if (units === null || units === undefined) return '0'
  const n = Number(formatUnits(BigInt(units), decimals))
  if (n >= 1_000_000) return `${trim(n / 1_000_000, 2)}M`
  if (n >= 10_000) return `${trim(n / 1_000, 1)}k`
  return trim(n, maxFrac)
}

function trim(n: number, frac: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: frac })
}

/** a / b as 0..1 from integer strings, safe for big values. */
export function ratio(a: string | bigint, b: string | bigint): number {
  const A = BigInt(a)
  const B = BigInt(b)
  if (B === 0n) return 0
  return Number((A * 10_000n) / B) / 10_000
}

export const pct = (r: number) => `${Math.round(Math.min(Math.max(r, 0), 9.99) * 100)}%`

export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export function plural(n: number | bigint, one: string, many = `${one}s`) {
  return `${n} ${BigInt(n) === 1n ? one : many}`
}

export function duration(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}
