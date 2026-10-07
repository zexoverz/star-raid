import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { fmt, RAID } from '../data'
import { clamp, Mascot, Pop, Sprite, StarAvatar, Twinkles, usePop } from '../ui'
import type { Who } from '../assets'

/** Act 5: VICTORY. The numbers are the results page's numbers for raid #26. */
export function Victory() {
  const frame = useCurrentFrame()
  const trophy = usePop(6, { damping: 9, stiffness: 160 })
  const title = usePop(14, { damping: 10, stiffness: 140 })
  const seat = RAID.seats[0]
  const stats = [
    { label: 'Counted hits', value: String(RAID.countedHits) },
    { label: 'Seats', value: String(RAID.seats.length) },
    { label: 'Wall share', value: `${Math.round(RAID.wallShare * 100)}%` },
    { label: 'Counted', value: `${fmt(RAID.counted)} / ${fmt(RAID.target)}` },
  ]
  return (
    <AbsoluteFill className="bg-grape-950">
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 18%, rgb(255 184 77 / 0.5), transparent 60%), linear-gradient(180deg,#2d2250,#15122a)' }} />
      <Sequence from={10} durationInFrames={60} layout="none">
        <Html5Audio src={staticFile('audio/kit/victory.mp3')} volume={0.9} />
      </Sequence>
      <Twinkles count={22} seed={11} />
      <Sprite
        slot="burst"
        className="absolute left-1/2 top-[230px] h-[900px] w-[900px] opacity-60"
        style={{ transform: `translate(-50%,-50%) rotate(${frame * 0.6}deg) scale(${trophy})` }}
      />
      <AbsoluteFill className="items-center pt-10">
        <div style={{ transform: `translateY(${(1 - trophy) * -80}px) rotate(${(1 - trophy) * -12}deg)` }}>
          <Sprite slot="wallKo" className="h-[240px] w-[240px] drop-shadow-[0_12px_0_#15122a]" />
        </div>
        <div className="title-outline -mt-2 text-[150px] leading-none text-ember-400" style={{ transform: `rotate(-2deg) scale(${0.5 + 0.5 * title})`, opacity: title }}>
          VICTORY!
        </div>
        <div className="mt-6 flex items-end justify-center gap-2">
          {(['chog', 'bunny', 'fox', 'bear'] as Who[]).map((w, i) => (
            <div key={w} style={{ transform: `translateY(${-Math.abs(Math.sin((frame - i * 4) / 7)) * 26}px)` }}>
              <Mascot who={w} p="cheer" style={{ height: 190, width: 'auto' }} />
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-10">
          <Pop delay={30} from="left">
            <div className="panel flex items-center gap-6 px-8 py-5">
              <Sprite slot="medalGold" className="h-16 w-16" />
              <StarAvatar tokenId={seat.tokenId} size={110} />
              <div>
                <div className="font-display text-[38px] text-white">Lil Star #{seat.tokenId}</div>
                <div className="text-[24px] text-ember-300">
                  {fmt(seat.counted)} counted · {seat.buys} hits
                </div>
                <div className="text-[24px] text-mint">prize share: all {fmt(RAID.bounty)} tUSDC</div>
              </div>
            </div>
          </Pop>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s, i) => (
              <Pop key={s.label} delay={38 + i * 5} from="scale">
                <div className="w-[260px] rounded-3xl bg-grape-950/70 px-5 py-3 text-center">
                  <div className="font-display text-[44px] leading-tight text-white">{s.value}</div>
                  <div className="text-[18px] font-bold uppercase tracking-widest text-grape-300">{s.label}</div>
                </div>
              </Pop>
            ))}
          </div>
        </div>
        <div className="mt-6 text-[22px] text-grape-300" style={{ opacity: interpolate(frame, [60, 72], [0, 1], clamp) }}>
          Testnet raid #{RAID.id}, settled on-chain. The prize unlocks after a {RAID.hold} s hold.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
