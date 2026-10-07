import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt, ratio } from '../lib/format'
import type { Phase } from '../lib/phase'
import { play } from '../lib/sfx'
import type { Frame, FrameBuy } from '../lib/types'
import { GameBar, Sprite } from './game'
import { CrewRow, Guide, Mascot } from './mascots'
import { PlayerPill } from './profile'
import { StarAvatar } from './game'
import { EmptyState } from './empty'

/**
 * The draw, told as a show in five beats. Every number comes from the frame (the chain), the show
 * only decides the order and timing:
 *   closed   the curtain falls, Pyth Entropy is drawing (waits here until the end block exists)
 *   block    the curtain parts on the end block
 *   judge    each hit is checked against the end block, one by one: counted or too late
 *   tally    the counted total fills toward the target
 *   verdict  VICTORY or THE WALL HELD (only once the raid has settled), with the crew
 * Plays live when the window closes, and on demand from "Replay the draw".
 */
type Stage = 'hidden' | 'closed' | 'block' | 'judge' | 'tally' | 'verdict'

export function DrawCurtain({ frame, phase, replay, onDone }: { frame: Frame; phase: Phase; replay: number; onDone?: () => void }) {
  const [stage, setStage] = useState<Stage>('hidden')
  const [judged, setJudged] = useState(0)
  const prevPhase = useRef<Phase | null>(null)
  const end = frame.endBlock
  const t = frame.terms

  // Only seated hits can count; no-seat buys are shown once as a group.
  const hits = useMemo(() => frame.buys.filter((b) => b.seatKey), [frame.buys])
  const noSeat = frame.buys.length - hits.length
  const settled = phase === 'victory' || phase === 'defeat'
  const won = phase === 'victory'
  const countedSoFar = useMemo(() => hits.slice(0, judged).reduce((a, b) => a + (b.afterEnd ? 0n : BigInt(b.countedAdded)), 0n), [hits, judged])

  const start = () => {
    setJudged(0)
    setStage('closed')
    play('drum')
  }

  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = phase
    if (prev === null) return
    const wasLive = prev === 'live' || prev === 'danger' || prev === 'upcoming'
    if (wasLive && (phase === 'drawing' || phase === 'revealed' || settled)) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (replay > 0) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay])

  // closed -> block, once the end block exists
  useEffect(() => {
    if (stage !== 'closed' || !end) return
    const id = setTimeout(() => (setStage('block'), play('reveal')), 2000)
    return () => clearTimeout(id)
  }, [stage, end])

  // block -> judge
  useEffect(() => {
    if (stage !== 'block') return
    const id = setTimeout(() => setStage(hits.length ? 'judge' : 'tally'), 2600)
    return () => clearTimeout(id)
  }, [stage, hits.length])

  // judge: one hit at a time, faster when there are many
  useEffect(() => {
    if (stage !== 'judge') return
    if (judged >= hits.length) {
      const id = setTimeout(() => setStage('tally'), 700)
      return () => clearTimeout(id)
    }
    const step = Math.max(140, Math.min(650, 3200 / hits.length))
    const id = setTimeout(() => {
      play(hits[judged].afterEnd ? 'tick' : 'coin')
      setJudged((j) => j + 1)
    }, step)
    return () => clearTimeout(id)
  }, [stage, judged, hits])

  // tally -> verdict (waits for settle if the result is not final yet)
  useEffect(() => {
    if (stage !== 'tally' || !settled) return
    const id = setTimeout(() => (setStage('verdict'), play(won ? 'victory' : 'defeat')), 1800)
    return () => clearTimeout(id)
  }, [stage, settled, won])

  // The verdict stays up until the player closes it.
  const close = () => (setStage('hidden'), onDone?.())

  const curtainOpen = stage !== 'closed'
  const shown = stage === 'judge' || stage === 'tally' || stage === 'verdict' ? hits.slice(0, stage === 'judge' ? judged : hits.length) : []
  const countedNow = stage === 'tally' || stage === 'verdict' ? BigInt(frame.counted) : countedSoFar

  return (
    <AnimatePresence>
      {stage !== 'hidden' && (
        <motion.div className="fixed inset-0 z-50 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <img src="/art/spotlight_stage.webp" onError={(e) => ((e.target as HTMLImageElement).src = '/art/raid_bg.webp')} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-grape-950/70" />
          {stage === 'verdict' && won && <Sprite name="victory_burst" className="absolute left-1/2 top-1/3 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow opacity-50" />}

          {/* ---- the show behind the curtain ---- */}
          <div className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-5 px-4 pb-10 pt-24 text-center">
              {curtainOpen && end && (
                <motion.div layout initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: stage === 'block' ? 1 : 0.7, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14, delay: stage === 'block' ? 0.6 : 0 }}>
                  <div className="flex items-center justify-center gap-3">
                    <Sprite name="dice_block" className={stage === 'block' ? 'h-24 w-24' : 'h-14 w-14'} />
                    <div className="text-left">
                      <div className="title-outline-sm text-2xl text-candy-300">End block</div>
                      <div className="title-outline text-4xl text-ember-400 sm:text-7xl">{Number(end).toLocaleString()}</div>
                    </div>
                  </div>
                  {stage === 'block' && <p className="mx-auto mt-3 max-w-md text-lg text-cream-100">Drawn by Pyth Entropy. Every hit at or before this block counts. Let's check the hits!</p>}
                </motion.div>
              )}

              {(stage === 'judge' || stage === 'tally' || stage === 'verdict') && (
                <motion.div layout className="w-full rounded-3xl border-[3px] border-grape-500 bg-grape-900/85 p-4 text-left shadow-[0_6px_0_#2d2250] backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-lg text-white">Checking every hit</span>
                    <span className="text-xs text-grape-300">
                      {Math.min(judged, hits.length)}/{hits.length} seated hits{noSeat > 0 ? ` · ${noSeat} without a seat, never counted` : ''}
                    </span>
                  </div>
                  <ul className="max-h-[32vh] space-y-1.5 overflow-y-auto pr-1">
                    {hits.length === 0 && (
                      <li>
                        <EmptyState scene="no-count" title="Nothing to count" size="sm">
                          No Star landed a hit in this raid.
                        </EmptyState>
                      </li>
                    )}
                    <AnimatePresence initial={false}>
                      {shown.map((b) => (
                        <JudgedHit key={b.id} b={b} decimals={t.quoteDecimals} />
                      ))}
                    </AnimatePresence>
                  </ul>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-widest text-grape-300">
                      <span>Counted toward target</span>
                      <span>
                        <span className="font-display text-base text-ember-300">{fmt(countedNow, t.quoteDecimals)}</span> / {fmt(t.target, t.quoteDecimals)} tUSDC
                      </span>
                    </div>
                    <GameBar value={ratio(countedNow, t.target)} height={26} tone={countedNow >= BigInt(t.target) ? 'mint' : 'ember'} marker={1}>
                      {countedNow >= BigInt(t.target) ? 'TARGET REACHED' : `${Math.round(ratio(countedNow, t.target) * 100)}%`}
                    </GameBar>
                  </div>
                </motion.div>
              )}

              {stage === 'tally' && !settled && <p className="animate-pulse font-display text-xl text-grape-300">Waiting for the raid to settle…</p>}

              {stage === 'verdict' && (
                <motion.div initial={{ scale: 0.5, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 11 }} className="flex flex-col items-center">
                  <h2 className={`title-outline -rotate-2 text-7xl sm:text-8xl ${won ? 'text-ember-400' : 'text-grape-300'}`}>{won ? 'VICTORY!' : 'The wall held'}</h2>
                  <div className="mt-2">
                    {won ? (
                      <CrewRow size="h-32 sm:h-40" pose="cheer" />
                    ) : (
                      <div className="flex items-end gap-2">
                        <Mascot who="bear" pose="sad" className="h-32" />
                        <Mascot who="bunny" pose="watch" className="h-28" />
                      </div>
                    )}
                  </div>
                  <p className="mt-3 max-w-lg text-lg text-cream-100">
                    {won
                      ? `${fmt(frame.counted, t.quoteDecimals)} of ${fmt(t.target, t.quoteDecimals)} counted. The ${fmt(t.bounty, t.quoteDecimals)} tUSDC prize splits across ${frame.seats.length} ${frame.seats.length === 1 ? 'seat' : 'seats'}.`
                      : `${fmt(frame.counted, t.quoteDecimals)} of ${fmt(t.target, t.quoteDecimals)} counted. The prize rolls to the sponsor's next raid.`}
                  </p>
                  {won && frame.seats[0] && <TopSeat seat={frame.seats[0]} frame={frame} />}
                  <button className="btn btn-primary mt-6 px-8 py-3 text-lg" onClick={close}>
                    {won ? 'See the loot' : 'Back to the raid'}
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          {/* ---- the curtain: two halves meet in the middle, then part left and right ---- */}
          <motion.div
            className="absolute inset-y-0 left-0 z-20 w-[51%] overflow-hidden shadow-[12px_0_30px_rgba(0,0,0,0.5)]"
            initial={{ x: '-100%' }}
            animate={{ x: curtainOpen ? '-100%' : '0%' }}
            transition={{ duration: curtainOpen ? 1.2 : 0.8, ease: [0.7, 0, 0.3, 1], delay: curtainOpen ? 0.2 : 0 }}
          >
            <img src="/art/curtain.webp" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/40 to-transparent" />
          </motion.div>
          <motion.div
            className="absolute inset-y-0 right-0 z-20 w-[51%] overflow-hidden shadow-[-12px_0_30px_rgba(0,0,0,0.5)]"
            initial={{ x: '100%' }}
            animate={{ x: curtainOpen ? '100%' : '0%' }}
            transition={{ duration: curtainOpen ? 1.2 : 0.8, ease: [0.7, 0, 0.3, 1], delay: curtainOpen ? 0.2 : 0 }}
          >
            <img src="/art/curtain.webp" alt="" className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/40 to-transparent" />
          </motion.div>
          <div className="absolute inset-x-0 top-0 z-30 h-16 bg-gradient-to-b from-[#2d2250] via-[#4a4373] to-transparent" />

          {stage === 'closed' && (
            <motion.div className="absolute inset-x-0 bottom-10 z-30 flex flex-col items-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
              <Guide who="bunny" pose="watch" size="h-28">
                {end ? 'The block is drawn… opening the curtain!' : "Shh… the curtain's closed. Pyth is rolling the end block!"}
              </Guide>
              <div className="title-outline mt-1 text-4xl">Drawing the end…</div>
              <div className="mx-auto mt-3 h-2 w-56 overflow-hidden rounded-full bg-grape-950/70">
                <motion.div className="h-full bg-ember-400" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
              </div>
            </motion.div>
          )}
          <button className="btn btn-ghost absolute right-4 top-20 z-40 px-4 py-2 text-xs" onClick={close}>
            {stage === 'verdict' ? 'Close' : 'Skip'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function JudgedHit({ b, decimals }: { b: FrameBuy; decimals: number }) {
  const late = !!b.afterEnd
  return (
    <motion.li layout initial={{ x: -40, opacity: 0, scale: 0.9 }} animate={{ x: 0, opacity: 1, scale: 1 }} className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 ${late ? 'bg-grape-950/40' : 'bg-mint/10'}`}>
      <StarAvatar tokenId={b.tokenId} size={34} dim={late} />
      <div className="min-w-0 flex-1 text-sm">
        <span className={`font-bold ${late ? 'text-grape-300 line-through' : 'text-white'}`}>{b.tokenId ? `Lil Star #${b.tokenId}` : 'Seat'}</span>
        <span className="text-grape-300"> · block {Number(b.block).toLocaleString()}</span>
        <div className="text-[11px] text-grape-300">
          <PlayerPill address={b.holder ?? b.player} size={14} />
        </div>
      </div>
      <motion.span initial={{ scale: 2.2, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} className={`chip ${late ? 'bg-grape-700 text-grape-300' : 'bg-mint text-grape-900'}`}>
        {late ? 'too late · +0' : `counted · +${fmt(b.countedAdded, decimals)}`}
      </motion.span>
    </motion.li>
  )
}

function TopSeat({ seat, frame }: { seat: Frame['seats'][number]; frame: Frame }) {
  const t = frame.terms
  const share = BigInt(frame.counted) > 0n ? (BigInt(t.bounty) * BigInt(seat.counted)) / BigInt(frame.counted) : 0n
  return (
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }} className="mt-4 flex items-center gap-3 rounded-3xl border-[3px] border-gold bg-grape-900/85 px-4 py-2.5">
      <Sprite name="medal_gold" className="h-10 w-10" />
      <StarAvatar tokenId={seat.tokenId} size={48} />
      <div className="text-left">
        <div className="text-xs font-bold uppercase tracking-widest text-gold">Top seat</div>
        <div className="font-display text-lg text-white">{seat.tokenId ? `Lil Star #${seat.tokenId}` : 'Human'}</div>
        <PlayerPill address={seat.holder ?? seat.player} className="text-xs text-grape-300" />
        <div className="text-xs text-grape-300">
          {fmt(seat.counted, t.quoteDecimals)} counted · about {fmt(share, t.quoteDecimals)} tUSDC of the prize
        </div>
      </div>
    </motion.div>
  )
}
