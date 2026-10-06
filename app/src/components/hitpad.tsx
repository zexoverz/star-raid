import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import { fmt } from '../lib/format'
import { play } from '../lib/sfx'
import { Sprite, StarAvatar } from './game'

export const HIT_SIZES = [3, 5, 10]

/** Mobile only: a thumb-reach HIT button pinned to the bottom while the window is open. */
export function FloatingHit({ open, onHit, amount, label = '⚔ HIT!' }: { open: boolean; onHit: (amount: bigint) => Promise<unknown>; amount: bigint; label?: string }) {
  const [burst, setBurst] = useState(0)
  if (!open) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-grape-950 via-grape-950/90 to-transparent px-4 pb-4 pt-8 lg:hidden">
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          play('hit')
          setBurst((b) => b + 1)
          void onHit(amount)
        }}
        className="btn btn-primary relative h-20 w-full overflow-visible text-3xl"
      >
        <AnimatePresence>
          <motion.span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5 }}>
            {burst > 0 && <Sprite name="hit_spark" className="h-32 w-32" />}
          </motion.span>
        </AnimatePresence>
        {label}
      </motion.button>
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
}) {
  const [hit, setHit] = useState(5)
  const [burst, setBurst] = useState(0)
  const units = parseUnits(String(hit), decimals)
  useEffect(() => onAmount?.(units), [units, onAmount])
  const can = open && balance >= units
  return (
    <div>
      <div className="flex items-center gap-3">
        <StarAvatar tokenId={tokenId} size={56} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight text-white">One-tap armed</div>
          <div className="text-xs text-grape-300">
            Star #{tokenId} · {fmt(balance, decimals)} tUSDC left · {hits} {hits === 1 ? 'hit' : 'hits'} landed
          </div>
        </div>
        <span className="chip bg-mint/20 text-mint">⚡ no popups</span>
      </div>

      <div className="mt-4 flex gap-2">
        {HIT_SIZES.map((h) => (
          <button key={h} onClick={() => (setHit(h), play('click'))} className={`flex-1 rounded-2xl py-2 font-display text-lg transition ${hit === h ? 'bg-ember-500 text-white shadow-[0_4px_0_#b4470a]' : 'bg-grape-800 text-grape-100 hover:bg-grape-700'}`}>
            {h}
            <span className="ml-1 text-xs opacity-70">tUSDC</span>
          </button>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={!can}
        onClick={() => {
          play('hit')
          setBurst((b) => b + 1)
          void onHit(units)
        }}
        className="btn btn-primary relative mt-4 h-28 w-full overflow-visible text-4xl"
      >
        <AnimatePresence>
          <motion.span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5 }}>
            {burst > 0 && <Sprite name="hit_spark" className="h-40 w-40" />}
          </motion.span>
        </AnimatePresence>
        {label}
      </motion.button>
      <div className="mt-2 flex justify-between text-xs text-grape-300">
        <span>{inflight > 0 ? `${inflight} hit(s) flying…` : 'Tap as fast as you like'}</span>
        <span>{open && balance < units ? 'budget used up' : ''}</span>
      </div>
      {error && <p className="mt-3 rounded-xl bg-candy-600/30 p-2 text-sm text-candy-300">{error}</p>}
      {footer}
    </div>
  )
}
