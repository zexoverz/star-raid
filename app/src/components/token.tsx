import { fmt } from '../lib/format'

/** Token logos, so every amount reads at a glance. tUSDC / tSTAR / MON plus the Lil Stars blind box and a revealed Star. */
export type Token = 'usdc' | 'star' | 'mon' | 'blindbox' | 'lilstar'
const SRC: Record<Token, string> = { usdc: '/tokens/usdc.svg', star: '/tokens/star.svg', mon: '/tokens/mon.svg', blindbox: '/tokens/blindbox.svg', lilstar: '/tokens/lilstar.svg' }
const NAME: Record<Token, string> = { usdc: 'tUSDC', star: 'tSTAR', mon: 'MON', blindbox: 'Lil Stars blind box', lilstar: 'Lil Star' }

export function TokenIcon({ token, size = 16, className = '' }: { token: Token; size?: number; className?: string }) {
  return <img src={SRC[token]} alt={NAME[token]} title={NAME[token]} width={size} height={size} className={`inline-block shrink-0 align-[-0.15em] ${className}`} draggable={false} />
}

/** Amount with its token logo: <TokenAmount token="usdc" value={x} decimals={6} />. */
export function TokenAmount({ token, value, decimals, dp, size = 14, showSymbol = false, className = '' }: { token: Token; value: bigint | string; decimals: number; dp?: number; size?: number; showSymbol?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}>
      <TokenIcon token={token} size={size} />
      <b className="text-white">{fmt(value, decimals, dp)}</b>
      {showSymbol && <span className="opacity-80">{NAME[token]}</span>}
    </span>
  )
}
