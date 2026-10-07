import { AnimatePresence, motion } from 'motion/react'
import { EXPLORER } from '../lib/config'
import { fmt, plural } from '../lib/format'
import { blocksToSec, type Phase } from '../lib/phase'
import type { Frame } from '../lib/types'
import { BotAvatar, Sprite } from './game'
import { EmptyState } from './empty'
import { TokenIcon } from './token'
import { PlayerAvatar } from './profile'
import { PlayerPill } from './profile'

/**
 * The raid window as a track: start → danger zone (where the end can be drawn) → last block.
 * The marker is the chain head. After the draw, the end block is pinned and later hits greyed.
 */
export function Timeline({ frame, head, phase }: { frame: Frame; head?: bigint; phase: Phase }) {
  const t = frame.terms
  const w0 = BigInt(t.w0)
  const w1 = BigInt(t.w1)
  const from = BigInt(t.drawFrom)
  const span = Number(w1 - w0) || 1
  const pos = (b: bigint) => Math.min(Math.max(Number(b - w0) / span, 0), 1) * 100
  const dangerLeft = pos(from)
  const end = frame.endBlock ? BigInt(frame.endBlock) : null
  const nowPos = head !== undefined ? pos(head) : null
  const toStart = head !== undefined && head < w0 ? w0 - head : null
  const toEnd = head !== undefined && head >= w0 && head <= w1 ? w1 - head : null

  return (
    <div className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sprite name="hourglass" className="h-9 w-9" />
          <div>
            <div className="font-display text-lg leading-none text-white">Raid window</div>
            <div className="text-xs text-grape-300">
              blocks {Number(w0).toLocaleString()} → {Number(w1).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="text-right font-display text-xl">
          {toStart !== null && <span className="text-sky">Starts in ~{Math.ceil(blocksToSec(toStart))}s</span>}
          {toEnd !== null && <span className={phase === 'danger' ? 'text-candy-300' : 'text-ember-300'}>~{Math.ceil(blocksToSec(toEnd))}s left</span>}
          {end !== null && <span className="text-gold">End drawn: block {Number(end).toLocaleString()}</span>}
          {phase === 'drawing' && end === null && <span className="animate-pulse text-grape-300">Drawing…</span>}
        </div>
      </div>

      <div className="relative h-14">
        <div className="absolute inset-x-0 top-5 h-4 rounded-full bg-grape-950 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_0_3px_#4a4373]" />
        <div className="absolute top-5 h-4 rounded-l-full bg-gradient-to-r from-ember-500/50 to-ember-400/70" style={{ left: 0, width: `${dangerLeft}%` }} />
        <div
          className={`absolute top-5 h-4 rounded-r-full ${phase === 'danger' ? 'animate-pulse' : ''}`}
          style={{ left: `${dangerLeft}%`, right: 0, background: 'repeating-linear-gradient(-45deg,#e826b1 0 8px,#aa3686 8px 16px)' }}
        />
        <div className="absolute -top-0.5 pl-6 text-[10px] font-bold uppercase tracking-widest text-candy-300" style={{ left: `${dangerLeft}%` }}>
          ☠ danger zone
        </div>
        {frame.buys.map((b) => (
          <div key={b.id} className={`absolute top-[18px] h-5 w-1.5 -translate-x-1/2 rounded-full ${b.afterEnd ? 'bg-grape-500' : b.seatKey ? 'bg-white shadow-[0_0_6px_#fff]' : 'bg-grape-300/60'}`} style={{ left: `${pos(BigInt(b.block))}%` }} title={`hit at block ${b.block}`} />
        ))}
        {nowPos !== null && head! <= w1 + 5n && head! >= w0 - 50n && (
          <motion.div className="absolute top-0 -translate-x-1/2" animate={{ left: `${nowPos}%` }} transition={{ type: 'spring', stiffness: 60, damping: 15 }}>
            <div className="h-12 w-[3px] rounded-full bg-sky shadow-[0_0_10px_#b6d6f7]" />
            <div className="mt-0.5 -translate-x-1/3 text-[10px] font-bold text-sky">NOW</div>
          </motion.div>
        )}
        <AnimatePresence>
          {end !== null && (
            <motion.div initial={{ y: -40, opacity: 0, scale: 2 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="absolute -top-3 -translate-x-1/2" style={{ left: `${pos(end)}%` }}>
              <Sprite name="dice_block" className="h-10 w-10" />
              <div className="mx-auto h-6 w-[3px] bg-gold" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 text-sm text-grape-300">
        The end block is drawn by Pyth Entropy <b className="text-white">after</b> the window closes, anywhere in the danger zone. Only hits at or before it count, so hit early.
      </p>
    </div>
  )
}

export function Party({ frame, me }: { frame: Frame; me?: string }) {
  const t = frame.terms
  const seats = frame.seats
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprite name="seat_ticket" className="h-9 w-9" />
          <div className="font-display text-lg text-white">The party</div>
        </div>
        <span className="chip bg-grape-700 text-grape-100">{plural(seats.length, 'seat')}</span>
      </div>
      {seats.length === 0 ? (
        <EmptyParty />
      ) : (
        <ol className="space-y-2">
          <AnimatePresence initial={false}>
            {seats.map((s, i) => {
              const mine = me && [s.player, s.holder].some((a) => a?.toLowerCase() === me.toLowerCase())
              return (
                <motion.li key={s.seatKey} layout initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${mine ? 'bg-ember-500/20 ring-2 ring-ember-400' : 'bg-grape-950/50'}`}>
                  <span className="w-6 text-center font-display text-lg text-grape-300">{i < 3 ? <Sprite name={['medal_gold', 'medal_silver', 'medal_bronze'][i]} className="h-7 w-7" /> : i + 1}</span>
                  <PlayerAvatar address={s.holder ?? s.player} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-white">
                      {s.tokenId ? `Star #${s.tokenId}` : 'Verified human'}
                      {mine && <span className="ml-2 chip bg-ember-500 text-white">you</span>}
                    </div>
                    <div className="flex min-w-0 items-center gap-1 text-xs text-grape-300">
                      <PlayerPill address={s.holder ?? s.player} hideAvatar /> <span className="shrink-0">· {s.buys} {s.buys === 1 ? 'hit' : 'hits'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 font-display text-lg text-ember-300"><TokenIcon token="usdc" size={15} />{fmt(s.counted, t.quoteDecimals)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-grape-300">counted</div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </div>
  )
}

function EmptyParty() {
  return (
    <EmptyState scene="no-seats" title="No seats yet" size="sm">
      The first Star to hit the wall opens the party!
    </EmptyState>
  )
}

export function HitFeed({ frame }: { frame: Frame }) {
  const t = frame.terms
  const buys = [...frame.buys].reverse()
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprite name="hit_spark" className="h-9 w-9" />
          <div className="font-display text-lg text-white">Hit log</div>
        </div>
        <span className="chip bg-grape-700 text-grape-100">{plural(frame.buys.length, 'hit')}</span>
      </div>
      {buys.length === 0 ? (
        <EmptyState scene="no-hits" title="No hits yet" size="sm">
          Every buy from the wall shows up here the block it lands.
        </EmptyState>
      ) : (
        <ul className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {buys.map((b) => (
              <motion.li key={b.id} layout initial={{ opacity: 0, y: -12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 ${b.afterEnd ? 'opacity-45 grayscale' : ''} ${b.seatKey ? 'bg-grape-950/50' : 'bg-grape-950/25'}`}>
                {b.seatKey ? <PlayerAvatar address={b.holder ?? b.player} size={32} ring={false} /> : <BotAvatar size={32} />}
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-bold text-white">{b.tokenId ? `Star #${b.tokenId}` : 'No seat'}</span>
                  <span className="text-grape-300"> bought {fmt(b.wallFillQuote, t.quoteDecimals)} from the wall</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[11px] text-grape-300">
                    <PlayerPill address={b.holder ?? b.player} hideAvatar size={14} /> · block {Number(b.block).toLocaleString()} ·{' '}
                    <a className="underline hover:text-white" href={`${EXPLORER}/tx/${b.tx}`} target="_blank" rel="noreferrer">
                      tx
                    </a>
                    {b.afterEnd && <span className="ml-1 text-candy-300">· after the end, not counted</span>}
                  </div>
                </div>
                <div className={`font-display text-base ${b.seatKey && !b.afterEnd ? 'text-ember-300' : 'text-grape-300'}`}>{b.seatKey && !b.afterEnd ? `+${fmt(b.countedAdded, t.quoteDecimals)}` : '+0'}</div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {BigInt(frame.nonSeatBuys) > 0n && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-grape-950/50 p-2.5 text-xs text-grape-300">
          <Sprite name="shield" className="h-8 w-8" />
          {frame.nonSeatBuys} {frame.nonSeatBuys === '1' ? 'buy' : 'buys'} without a seat went through and count for nothing.
        </div>
      )}
    </div>
  )
}
