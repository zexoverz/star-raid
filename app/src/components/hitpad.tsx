import { AnimatePresence, motion } from 'motion/react'
import { TokenAmount, TokenIcon } from './token'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import { play } from '../lib/sfx'
import { Sprite, StarAvatar } from './game'

export const HIT_SIZES = [3, 5, 10]

/**
 * Phones only: a thumb-reach HIT dock pinned to the bottom while the window is open. It takes the
 * tab bar's place (body[data-hit-dock] hides the tab bar) so the two never stack. Amount chips sit
 * right above the button, so a raider never has to scroll back up to the pad.
 */
export function FloatingHit({
  open,
  onHit,
  amount,
  label = '⚔ HIT!',
  onAmount,
  decimals = 6,
  sub,
}: {
  open: boolean
  onHit: (amount: bigint) => Promise<unknown>
  amount: bigint
  label?: string
  onAmount?: (units: bigint) => void
  decimals?: number
  sub?: React.ReactNode
}) {
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    if (!open) return
    document.body.dataset.hitDock = '1'
    return () => void delete document.body.dataset.hitDock
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-grape-950 via-grape-950/95 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 lg:hidden">
      {onAmount && (
        <div className="mb-2 flex gap-2">
          {HIT_SIZES.map((h) => {
            const u = parseUnits(String(h), decimals)
            const on = u === amount
            return (
              <button key={h} onClick={() => (onAmount(u), play('click'))} className={`flex min-h-11 flex-1 items-center justify-center rounded-2xl font-display text-lg ${on ? 'bg-ember-500 text-white shadow-[0_3px_0_#b4470a]' : 'bg-grape-800/95 text-grape-100'}`}>
                <TokenIcon token="usdc" size={16} className="mr-1" />
                {h}
              </button>
            )
          })}
        </div>
      )}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          play('hit')
          setBurst((b) => b + 1)
          void onHit(amount)
        }}
        className="btn btn-primary relative h-20 w-full overflow-hidden text-3xl"
      >
        <AnimatePresence>
          <motion.span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5 }}>
            {burst > 0 && <Sprite name="hit_spark" className="h-32 w-32" />}
          </motion.span>
        </AnimatePresence>
        {label}
      </motion.button>
      {sub && <div className="mt-1.5 text-center text-[13px] font-semibold text-grape-300">{sub}</div>}
    </div>
  )
}

/** The one-tap HIT pad. Same UI for a real armed raid key and the practice raid. */
export function HitPad({
  tokenId,
  decimals,
  balance,
  open,
  label,
  hits,
  inflight,
  onHit,
  footer,
  error,
  onAmount,
  amount,
  refill,
}: {
  tokenId: string
  decimals: number
  balance: bigint
  open: boolean
  label: string
  hits: number
  inflight: number
  onHit: (amount: bigint) => Promise<unknown>
  footer?: React.ReactNode
  error?: string | null
  onAmount?: (units: bigint) => void
  /** Selected hit size in token units; makes the size picker controlled. */
  amount?: bigint
  /** When set, the key cannot pay for a hit: the big button becomes this (one wallet popup) instead. */
  refill?: { label: string; onClick: () => void; busy?: boolean }
}) {
  const [hitState, setHit] = useState(5)
  const [burst, setBurst] = useState(0)
  // Controlled when the parent passes `amount` (the phone dock and the pad share one choice).
  const hit = amount !== undefined ? Number(amount) / 10 ** decimals : hitState
  const units = parseUnits(String(hit), decimals)
  useEffect(() => {
    if (amount === undefined) onAmount?.(units)
  }, [units, onAmount, amount])
  const pick = (h: number) => (amount !== undefined ? onAmount?.(parseUnits(String(h), decimals)) : setHit(h))
  const can = open && balance >= units
  return (
    <div>
      <div className="flex items-center gap-3">
        <StarAvatar tokenId={tokenId} size={56} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight text-white">{refill ? 'Raid key needs a top up' : 'One-tap armed'}</div>
          <div className="text-xs text-grape-300">
            Star #{tokenId} · <TokenAmount token="usdc" value={balance} decimals={decimals} size={12} /> left · {hits} {hits === 1 ? 'hit' : 'hits'} landed
          </div>
        </div>
        {refill ? <span className="chip bg-ember-500/20 text-ember-300">low funds</span> : <span className="chip bg-mint/20 text-mint">⚡ no popups</span>}
      </div>

      <div className="hitpad-inline mt-4 flex gap-2">
        {HIT_SIZES.map((h) => (
          <button key={h} onClick={() => (pick(h), play('click'))} className={`flex min-h-11 flex-1 items-center justify-center rounded-2xl py-2 font-display text-lg transition ${hit === h ? 'bg-ember-500 text-white shadow-[0_4px_0_#b4470a]' : 'bg-grape-800 text-grape-100 hover:bg-grape-700'}`}>
            <TokenIcon token="usdc" size={16} className="mr-1" />
            {h}
          </button>
        ))}
      </div>

      {refill ? (
        <button className="btn btn-candy mt-4 flex h-28 w-full flex-col items-center justify-center gap-1" disabled={refill.busy} onClick={refill.onClick}>
          <span className="text-3xl">{refill.label}</span>
          <span className="text-xs font-semibold opacity-90">one wallet popup, then back to tap-to-hit</span>
        </button>
      ) : (
      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={!can}
        data-pad-hit
        onClick={() => {
          play('hit')
          setBurst((b) => b + 1)
          void onHit(units)
        }}
        className="btn btn-primary relative mt-4 h-24 w-full overflow-hidden text-4xl sm:h-28"
      >
        <AnimatePresence>
          <motion.span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5 }}>
            {burst > 0 && <Sprite name="hit_spark" className="h-40 w-40" />}
          </motion.span>
        </AnimatePresence>
        {label}
      </motion.button>
      )}
      <div className="mt-2 flex justify-between text-[13px] text-grape-300">
        <span>{refill ? 'Top up, then tap as fast as you like' : inflight > 0 ? `${inflight} hit(s) flying…` : 'Tap as fast as you like'}</span>
        <span>{open && balance < units ? 'budget used up' : ''}</span>
      </div>
      {error && <p className="mt-3 rounded-xl bg-candy-600/30 p-2 text-sm text-candy-300">{error}</p>}
      {footer}
    </div>
  )
}
