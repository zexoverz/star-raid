import { useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useActions, useWalletKit } from '../lib/player'
import { play } from '../lib/sfx'
import { TokenAmount, TokenIcon } from './token'

/** tUSDC amount (6 decimals) as plain text, max 2 decimals: 12.5, 50, 0.25. */
export const fmtPlain = (v: bigint) => {
  const s = formatUnits(v, 6)
  return s.includes('.') ? s.replace(/\.?0+$/, '').replace(/(\.\d{2})\d+$/, '$1') : s
}

export function parseAmount(text: string): bigint {
  try {
    return text.trim() ? parseUnits(text.trim(), 6) : 0n
  } catch {
    return -1n
  }
}

/**
 * Any amount of tUSDC up to the wallet balance: type it, drag the % of the wallet, or tap a chip.
 * Shows the wallet and raid key balances and what the key holds after. No fixed cap.
 * Testnet easter egg: tap the coin 3 times to mint 50 free test tUSDC.
 */
export function AmountInput({ value, onChange, keyBalance }: { value: string; onChange: (v: string) => void; keyBalance: bigint }) {
  const kit = useWalletKit()
  const act = useActions()
  const wallet = kit.usdc ?? 0n
  const [taps, setTaps] = useState(0)
  const amount = parseAmount(value)
  const pct = wallet > 0n && amount > 0n ? Math.min(100, Number((amount * 10000n) / wallet) / 100) : 0
  const setPct = (p: number) => onChange(fmtPlain((wallet * BigInt(Math.round(p * 100))) / 10000n))
  const tooMuch = amount > wallet
  const egg = () => {
    const n = taps + 1
    setTaps(n)
    play('click')
    if (n >= 3) {
      setTaps(0)
      void act.getTestKit(false, true).then((ok) => ok && (kit.refetch(), play('coin')))
    }
  }
  return (
    <div>
      <div className={`flex items-center gap-2 rounded-2xl bg-grape-950/70 px-3 py-2 ring-2 ${tooMuch || amount < 0n ? 'ring-candy-500' : 'ring-transparent focus-within:ring-ember-400'}`}>
        <button type="button" onClick={egg} title={taps ? `${3 - taps} more…` : 'tUSDC'} className={`shrink-0 transition-transform active:scale-90 ${taps ? 'animate-wiggle' : ''}`}>
          <TokenIcon token="usdc" size={28} />
        </button>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          className="min-w-0 flex-1 bg-transparent font-display text-2xl text-white outline-none placeholder:text-grape-600"
          placeholder="0"
          aria-label="Amount of tUSDC to send to the raid key"
        />
        <button type="button" className="chip bg-grape-700 text-grape-100 hover:bg-grape-600" onClick={() => setPct(100)}>
          MAX
        </button>
      </div>
      <input type="range" min={0} max={100} step={1} value={Math.round(pct)} onChange={(e) => setPct(Number(e.target.value))} className="mt-3 w-full accent-[#FF8C42]" aria-label="Percent of wallet tUSDC" />
      <div className="mt-1 flex gap-1.5">
        {[25, 50, 75, 100].map((p) => (
          <button key={p} type="button" onClick={() => setPct(p)} className={`flex-1 rounded-lg py-1 text-xs font-bold ${Math.round(pct) === p ? 'bg-ember-500 text-white' : 'bg-grape-800 text-grape-200 hover:bg-grape-700'}`}>
            {p}%
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-grape-300">
        <div className="rounded-xl bg-grape-950/50 px-2 py-1.5">
          Wallet <TokenAmount token="usdc" value={wallet} decimals={6} size={12} />
          <div>
            {tooMuch ? <span className="text-candy-300">not enough</span> : `${Math.round(pct)}% of it`}
            {wallet < 1_000_000n && (
              <button type="button" className="ml-1 font-bold text-ember-300 underline" disabled={act.busy} onClick={() => void act.getTestKit(false, true).then((ok) => ok && (kit.refetch(), play('coin')))}>
                mint 50
              </button>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-grape-950/50 px-2 py-1.5">
          Raid key <TokenAmount token="usdc" value={keyBalance} decimals={6} size={12} />
          <div>after: {fmtPlain(keyBalance + (amount > 0n ? amount : 0n))}</div>
        </div>
      </div>
      {act.busy && <p className="mt-2 text-xs text-ember-300">Minting test tUSDC, confirm in your wallet…</p>}
    </div>
  )
}
