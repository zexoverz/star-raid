import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { fmt, duration, ratio } from '../lib/format'
import type { Phase } from '../lib/phase'
import { useActions, usePlayerSeat } from '../lib/player'
import { useOneTap } from '../lib/onetap'
import { play } from '../lib/sfx'
import type { Frame } from '../lib/types'
import { Sprite, Twinkles } from './game'
import { CrewRow, Guide } from './mascots'
import { TxSteps } from './join'
import { TokenIcon } from './token'
import { PlayerAvatar } from './profile'
import { PlayerPill } from './profile'

/** VICTORY / WALL HELD banner. Every number is one the chain shows. */
export function ResultBanner({ frame, phase, onReplay, me, shareable = true }: { frame: Frame; phase: Phase; onReplay: () => void; me?: string; shareable?: boolean }) {
  const t = frame.terms
  const won = phase === 'victory'
  const mySeat = me ? (frame.seats.find((s) => [s.player, s.holder].some((a) => a?.toLowerCase() === me.toLowerCase()))?.tokenId ?? null) : null
  const share = ratio(frame.totals.wallFillQuote, frame.totals.quoteSpent)
  const countedBuys = frame.buys.filter((b) => b.seatKey && b.afterEnd === false).length
  const lateBuys = frame.buys.filter((b) => b.afterEnd).length
  useEffect(() => {
    play(won ? 'victory' : 'defeat')
  }, [won])

  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel relative overflow-hidden p-6 text-center sm:p-8">
      <div className="absolute inset-0 -z-0" style={{ background: won ? 'radial-gradient(circle at 50% 0%, rgb(255 184 77 / 0.45), transparent 65%)' : 'radial-gradient(circle at 50% 0%, rgb(122 110 178 / 0.4), transparent 65%)' }} />
      {won && <Twinkles count={14} />}
      <div className="relative">
        <div className="relative mx-auto h-40 w-40">
          {won && <Sprite name="victory_burst" className="absolute -inset-16 h-72 w-72 animate-spin-slow opacity-70" />}
          <motion.div initial={{ y: -40, rotate: -10 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }}>
            <Sprite name={won ? 'trophy' : 'defeat'} className="relative h-40 w-40 drop-shadow-[0_8px_0_#15122a]" />
          </motion.div>
        </div>
        <h2 className={`title-outline mt-2 -rotate-2 text-6xl sm:text-7xl ${won ? 'text-ember-400' : 'text-grape-300'}`}>{won ? 'VICTORY!' : 'The wall held'}</h2>
        <div className="mt-3 flex justify-center">
          {won ? <CrewRow size="h-28 sm:h-36" pose="cheer" /> : <Guide who="bear" pose="sad" size="h-28">So close! The prize rolls into the sponsor's next raid. See you there?</Guide>}
        </div>
        <p className="mx-auto mt-3 max-w-xl text-cream-100/90">
          {won
            ? `The seats counted ${fmt(frame.counted, t.quoteDecimals)} tUSDC of wall buys against a ${fmt(t.target, t.quoteDecimals)} target. The ${fmt(t.bounty, t.quoteDecimals)} tUSDC prize splits across the seats by what each counted.`
            : `The seats counted ${fmt(frame.counted, t.quoteDecimals)} of the ${fmt(t.target, t.quoteDecimals)} tUSDC target before the end block. The prize rolls to the sponsor's next raid.`}
        </p>
        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Big label="Counted hits" value={String(countedBuys)} />
          <Big label="Seats" value={String(frame.seats.length)} />
          <Big label="Wall share" value={`${Math.round(share * 100)}%`} hint="of all tUSDC spent bought from the sponsor's wall" />
          <Big label="No-seat buys" value={frame.nonSeatBuys} hint="went through, counted for nothing" />
        </div>
        {lateBuys > 0 && <p className="mt-3 text-xs text-grape-300">{lateBuys} hit(s) landed after the end block and did not count.</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {frame.endBlock && (
            <button className="btn btn-ghost px-5 py-2 text-sm" onClick={onReplay}>
              🎭 Replay the draw
            </button>
          )}
          {shareable && (
            <Link to="/r/$raidId/$seat" params={{ raidId: frame.raidId, seat: mySeat ?? 'raid' }} className="btn btn-candy px-5 py-2 text-sm">
              📣 {mySeat ? 'Share your card' : 'Share this raid'}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Big({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-grape-950/60 p-3" title={hint}>
      <div className="font-display text-3xl text-white">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-grape-300">{label}</div>
    </div>
  )
}

/** The seat split, podium style. */
export function Podium({ frame, shareable = true }: { frame: Frame; shareable?: boolean }) {
  const t = frame.terms
  const top = frame.seats.slice(0, 3)
  if (!top.length) return null
  const order = [top[1], top[0], top[2]].filter(Boolean)
  const heights = { 0: 'h-32', 1: 'h-24', 2: 'h-16' } as Record<number, string>
  return (
    <div className="panel p-6">
      <div className="title-outline-sm mb-6 text-center text-3xl">Top seats</div>
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {order.map((s) => {
          const rank = frame.seats.indexOf(s)
          const won = frame.won
          const share = won && BigInt(frame.counted) > 0n ? (BigInt(t.bounty) * BigInt(s.counted)) / BigInt(frame.counted) : 0n
          return (
            <motion.div key={s.seatKey} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 * (2 - rank) }} className="flex w-28 flex-col items-center sm:w-36">
              <Sprite name={['medal_gold', 'medal_silver', 'medal_bronze'][rank]} className="-mb-3 h-10 w-10" />
              <PlayerAvatar address={s.holder ?? s.player} size={rank === 0 ? 96 : 76} />
              <div className="mt-2 truncate text-center text-sm font-bold text-white">{s.tokenId ? `Star #${s.tokenId}` : 'Human'}</div>
              <PlayerPill address={s.holder ?? s.player} hideAvatar className="max-w-full text-xs text-grape-300" />
              <div className="font-display text-ember-300">{fmt(s.counted, t.quoteDecimals)} counted</div>
              {won && <div className="text-xs text-mint">≈ {fmt(share, t.quoteDecimals)} prize</div>}
              <div className={`mt-2 w-full rounded-t-2xl ${heights[rank]} grid place-items-start justify-center pt-2 font-display text-3xl text-white`} style={{ background: ['linear-gradient(#ffd27a,#ff8c42)', 'linear-gradient(#ece8ff,#b8aee6)', 'linear-gradient(#ffb48a,#c56a3a)'][rank], boxShadow: '0 4px 0 #2d2250' }}>
                {rank + 1}
              </div>
              {shareable && s.tokenId && (
                <Link to="/r/$raidId/$seat" params={{ raidId: frame.raidId, seat: s.tokenId }} className="mt-2 text-xs font-bold text-candy-300 underline">
                  share card
                </Link>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/** Loot chest: the player's own escrow and prize, the hold countdown, claim and exit early. */
export function LootPanel({ frame, phase }: { frame: Frame; phase: Phase }) {
  const one = useOneTap(frame.raidId)
  const walletSeat = usePlayerSeat(frame.raidId)
  const keySeat = usePlayerSeat(frame.raidId, one.keyAddress)
  const viaKey = !!keySeat.seatKey && !!one.session
  const seat = viaKey ? keySeat : walletSeat
  const act = useActions()
  const t = frame.terms
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() / 1000), 1000)
    return () => clearInterval(i)
  }, [])
  if (!seat.seatKey) return null
  const settled = phase === 'victory' || phase === 'defeat'
  const unlockAt = (frame.settledAt ?? 0) + t.hold
  const left = unlockAt - now
  const holdOver = phase !== 'victory' || left <= 0
  const done = seat.done

  return (
    <div className="panel relative overflow-hidden p-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <motion.div animate={done ? {} : { rotate: [0, -3, 3, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="relative shrink-0">
          <Sprite name={done ? 'chest_open' : holdOver && settled ? 'chest_open' : 'chest_closed'} className="h-36 w-36 drop-shadow-[0_8px_0_#15122a]" />
          {!holdOver && <Sprite name="lock" className="absolute -right-2 -top-2 h-12 w-12" />}
        </motion.div>
        <div className="flex-1 text-center sm:text-left">
          <div className="title-outline-sm text-3xl">{done ? 'Loot collected' : 'Your loot'}</div>
          <p className="mt-1 text-xs text-grape-300">Every HIT bought tSTAR from the wall. The router kept it safe for your seat; claiming sends it to your wallet{phase === 'victory' ? ', plus your share of the prize' : ''}.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="chip bg-grape-700 text-grape-100"><TokenIcon token="star" size={14} /> {seat.escrowBase !== undefined ? fmt(seat.escrowBase, t.baseDecimals) : '…'} tSTAR you bought, waiting for you</span>
            {phase === 'victory' && <span className="chip bg-ember-500/30 text-ember-300">🏆 <TokenIcon token="usdc" size={14} /> {seat.prize !== undefined ? fmt(seat.prize, t.quoteDecimals) : '…'} prize share</span>}
          </div>
          {!settled && <p className="mt-3 text-sm text-grape-300">Claims open once the raid settles.</p>}
          {settled && !done && phase === 'victory' && !holdOver && (
            <p className="mt-3 text-sm text-grape-300">
              The hold ends in <b className="font-display text-lg text-white">{duration(left)}</b>. Claim then for your tSTAR plus your prize share, or exit early now and forfeit the prize share.
            </p>
          )}
          {settled && !done && holdOver && <p className="mt-3 text-sm text-grape-300">{phase === 'victory' ? 'The hold is over. Open the chest.' : 'The wall held, so there is no prize. Your tSTAR is ready to collect.'}</p>}
          {!done && settled && (
            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
              <button
                className="btn btn-primary px-6 py-3 text-lg"
                disabled={!holdOver || act.busy || !!one.status}
                onClick={async () => {
                  const ok = viaKey ? (await one.keyCall('claim')) && (await one.sweep(false)) : await act.claim(frame.raidId)
                  if (ok) {
                    play('coin')
                    seat.refetch()
                  }
                }}
              >
                {holdOver ? '🗝 Claim' : `🔒 ${duration(left)}`}
              </button>
              {phase === 'victory' && !holdOver && (
                <button
                  className="btn btn-ghost px-5 py-3 text-sm"
                  disabled={act.busy || !!one.status}
                  onClick={async () => {
                    const ok = viaKey ? (await one.keyCall('exitEarly')) && (await one.sweep(false)) : await act.exitEarly(frame.raidId)
                    if (ok) seat.refetch()
                  }}
                >
                  Exit early (forfeit prize)
                </button>
              )}
            </div>
          )}
          {viaKey && <p className="mt-2 text-xs text-grape-300">Claimed from your one-tap raid key. Your tSTAR goes to your wallet; the prize and leftover tUSDC stay on the key for the next raid (“Return to wallet” any time).</p>}
          {one.status && <p className="mt-2 text-sm text-ember-300">{one.status}…</p>}
          <TxSteps steps={act.steps} error={act.error} />
        </div>
      </div>
    </div>
  )
}
