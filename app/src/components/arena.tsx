import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { fmt, ratio } from '../lib/format'
import type { Phase } from '../lib/phase'
import { play } from '../lib/sfx'
import type { Frame, FrameBuy } from '../lib/types'
import { GameBar, Sprite, StarAvatar, Twinkles } from './game'
import { TokenIcon } from './token'
import { Guide, StageCrew } from './mascots'

interface Hit {
  key: string
  buy: FrameBuy
  x: number
  y: number
}

/** Watches the feed and returns buys that arrived since the screen opened (never replays history). */
export function useNewBuys(frame: Frame | undefined) {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<FrameBuy[]>([])
  useEffect(() => {
    if (!frame) return
    if (seen.current === null) {
      seen.current = new Set(frame.buys.map((b) => b.id))
      return
    }
    const added = frame.buys.filter((b) => !seen.current!.has(b.id))
    if (added.length) {
      added.forEach((b) => seen.current!.add(b.id))
      setFresh(added)
    }
  }, [frame])
  return fresh
}

export function Arena({ frame, phase, tentative }: { frame: Frame; phase: Phase; tentative: boolean }) {
  const t = frame.terms
  const wallLeft = 1 - ratio(frame.wallSold, t.wallSize)
  const progress = ratio(frame.counted, t.target)
  const fresh = useNewBuys(frame)
  const [hits, setHits] = useState<Hit[]>([])
  const [combo, setCombo] = useState(0)
  const [shake, setShake] = useState(0)
  const [line, setLine] = useState<string | null>(null)
  const comboTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!fresh.length) return
    const add = fresh.map((b, i) => ({ key: `${b.id}-${Date.now()}`, buy: b, x: 25 + ((i * 37 + Number(b.block) * 13) % 50), y: 18 + ((i * 23 + Number(b.block) * 7) % 45) }))
    setHits((h) => [...h, ...add].slice(-12))
    setShake((s) => s + 1)
    setCombo((c) => c + fresh.length)
    clearTimeout(comboTimer.current)
    comboTimer.current = setTimeout(() => setCombo(0), 3500)
    play(fresh.length > 1 ? 'combo' : 'hit')
    const seated = fresh.filter((b) => b.seatKey)
    setLine(seated.length ? (fresh.length > 1 ? `Combo! ${fresh.length} hits in one go!` : `Lil Star #${seated[0].tokenId} landed a hit!`) : 'A wallet with no seat bought in. That one counts for nothing.')
    const ids = add.map((a) => a.key)
    setTimeout(() => setHits((h) => h.filter((x) => !ids.includes(x.key))), 1800)
  }, [fresh])

  const boss = phase === 'victory' || frame.wall === 'filled' ? 'wall_boss_ko' : wallLeft < 0.6 || progress > 0.5 ? 'wall_boss_hurt' : 'wall_boss'
  const crewMood = phase === 'victory' ? 'cheer' : phase === 'defeat' ? 'gloom' : phase === 'live' || phase === 'danger' ? 'fight' : phase === 'drawing' || phase === 'revealed' ? 'watch' : 'wait'
  const tip =
    line ??
    (phase === 'upcoming'
      ? 'Set up one-tap now (once, it works for every raid) so you are ready the second the window opens!'
      : phase === 'live'
        ? 'Hit early! The end block can land anywhere in the danger zone.'
        : phase === 'danger'
          ? 'Danger zone! The end could be any block now. Hits after it will not count!'
          : phase === 'drawing'
            ? 'Pyth is drawing the end block. Fingers crossed!'
            : phase === 'revealed'
              ? 'The end block is in. Settling the results…'
              : phase === 'victory'
                ? 'We broke the wall! Open your chest after the hold.'
                : phase === 'defeat'
                  ? 'The wall held this time. The prize rolls to the next raid.'
                  : 'This raid did not open. Everyone got refunded.')

  return (
    <div className="relative isolate overflow-hidden rounded-[32px] border-[3px] border-grape-500 shadow-[0_8px_0_#2d2250,0_24px_60px_rgba(0,0,0,0.45)]">
      <img src="/art/raid_bg.webp" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-grape-950 via-grape-950/30 to-grape-950/50" />
      <Twinkles count={10} />

      {/* Boss HP */}
      <div className="relative z-10 px-5 pt-5 sm:px-8">
        <div className="mb-1.5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sprite name="flag_sponsor" className="h-8 w-8" />
            <div>
              <div className="title-outline-sm text-xl leading-none sm:text-2xl">The Sponsor's Wall</div>
              <div className="text-xs text-grape-300">
                {fmt(t.wallSize, t.baseDecimals)} tSTAR resting at the cap · {wallStatusText(frame.wall)}
              </div>
            </div>
          </div>
          <div className={`font-display text-2xl text-white ${tentative ? 'tentative' : 'firm'}`}>{Math.round(wallLeft * 100)}%</div>
        </div>
        <GameBar value={wallLeft} tone="boss" height={30} tentative={tentative}>
          {fmt(BigInt(t.wallSize) - BigInt(frame.wallSold), t.baseDecimals)} left
        </GameBar>
      </div>

      {/* Stage */}
      <div className="relative z-0 flex h-[340px] items-start justify-center pt-4 sm:h-[400px]">
        <StageCrew hitTick={shake} mood={crewMood} />
        <motion.div key={shake} animate={shake ? { x: [0, -14, 12, -8, 6, 0], rotate: [0, -2, 2, -1, 0] } : {}} transition={{ duration: 0.45 }} className="relative">
          <motion.img
            src={`/art/${boss}.webp`}
            onError={(e) => ((e.target as HTMLImageElement).src = '/art/wall_boss.webp')}
            alt="The sponsor's wall"
            className="h-[230px] w-[230px] object-contain drop-shadow-[0_18px_0_rgba(21,18,42,0.55)] sm:h-[290px] sm:w-[290px]"
            animate={phase === 'defeat' ? { rotate: [0, 3, -3, 0] } : phase === 'victory' ? {} : { y: [0, -8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            draggable={false}
          />
        </motion.div>

        <AnimatePresence>
          {hits.map((h) => (
            <motion.div key={h.key} className="pointer-events-none absolute z-20" style={{ left: `${h.x}%`, top: `${h.y}%` }} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, y: -40 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <div className="relative">
                <Sprite name="hit_spark" className="absolute -left-10 -top-10 h-24 w-24 opacity-90" />
                <StarAvatar tokenId={h.buy.tokenId} size={48} />
                <div className={`absolute left-12 top-0 whitespace-nowrap font-display text-xl ${h.buy.seatKey ? 'text-ember-300' : 'text-grape-300'} [-webkit-text-stroke:3px_#2d2250] [paint-order:stroke_fill]`}>
                  {h.buy.seatKey ? `+${fmt(h.buy.countedAdded, t.quoteDecimals)}` : 'no seat · +0'}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {combo > 1 && (
            <motion.div key={combo} initial={{ scale: 2, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} exit={{ opacity: 0 }} className="absolute right-6 top-6 z-30 text-right">
              <div className="title-outline text-5xl text-candy-300">COMBO</div>
              <div className="title-outline text-6xl text-ember-400">x{combo}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'victory' && <Sprite name="victory_burst" className="absolute inset-0 m-auto h-[420px] w-[420px] animate-spin-slow opacity-70" />}
      </div>

      {/* Target meter */}
      <div className="relative z-10 px-5 pb-5 sm:px-8">
        <div className="-mt-2 mb-3 flex justify-center">
          <Guide
            who={phase === 'danger' || phase === 'drawing' ? 'bunny' : phase === 'defeat' ? 'bear' : phase === 'victory' ? 'chog' : 'fox'}
            pose={phase === 'danger' || phase === 'drawing' ? 'watch' : phase === 'defeat' ? 'sad' : phase === 'victory' ? 'cheer' : line ? 'attack' : 'think'}
            size="h-20"
          >
            {tip}
          </Guide>
        </div>
        <div className="mb-1.5 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <Sprite name="trophy" className="h-9 w-9" />
            <div>
              <div className="font-display text-lg leading-none text-white">Raid target</div>
              <div className="text-xs text-grape-300">counted wall buys by seats, each seat capped at {fmt(t.seatCap, t.quoteDecimals)}</div>
            </div>
          </div>
          <div className={`text-right ${tentative ? 'tentative' : 'firm'}`}>
            <span className="font-display text-2xl text-ember-400">{fmt(frame.counted, t.quoteDecimals)}</span>
            <span className="text-grape-300"> / {fmt(t.target, t.quoteDecimals)} <TokenIcon token="usdc" size={14} /></span>
          </div>
        </div>
        <GameBar value={progress} height={30} tentative={tentative} tone={progress >= 1 ? 'mint' : 'ember'}>
          {progress >= 1 ? 'TARGET REACHED' : `${Math.round(progress * 100)}%`}
        </GameBar>
      </div>
    </div>
  )
}

function wallStatusText(w: Frame['wall']) {
  switch (w) {
    case 'none':
      return 'not placed yet'
    case 'active':
      return 'standing'
    case 'filled':
      return 'fully bought out'
    case 'cancelled':
      return 'taken down at settle'
  }
}
