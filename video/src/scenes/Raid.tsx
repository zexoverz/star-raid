import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { fmt, RAID } from '../data'
import { clamp, GameBar, Mascot, shake, Sprite, StarAvatar, Twinkles, Bg } from '../ui'
import type { Who } from '../assets'

/** Act 3: the live raid. Raid #26's real buys, replayed by block number (sped up). */
const START = 24 // first frame of the replay
const END = 250 // frame the last replayed block lands on
const firstBlock = RAID.w0
const lastBlock = RAID.buys[RAID.buys.length - 1].block + 6
export const blockToFrame = (b: number) => Math.round(interpolate(b, [firstBlock, lastBlock], [START, END]))
const frameToBlock = (f: number) => Math.round(interpolate(f, [START, END], [firstBlock, lastBlock], clamp))

/** One hit event per block (several buys can land in one block: a combo). */
const HITS = (() => {
  const by = new Map<number, typeof RAID.buys>()
  for (const b of RAID.buys) by.set(b.block, [...(by.get(b.block) ?? []), b])
  return [...by.entries()].map(([block, buys], i) => ({ block, buys, at: blockToFrame(block), i }))
})()

export function Raid() {
  const frame = useCurrentFrame()
  const landed = HITS.filter((h) => h.at <= frame)
  const buysLanded = landed.flatMap((h) => h.buys)
  const counted = buysLanded.reduce((a, b) => a + b.counted, 0)
  const sold = buysLanded.reduce((a, b) => a + b.base, 0)
  const progress = counted / RAID.target
  const wallLeft = 1 - sold / RAID.wallSize
  const last = landed[landed.length - 1]
  const boss = progress > 0.5 ? 'wallHurt' : 'wall'
  const bossShake = last ? shake(frame, last.at, 16) : 0
  const block = frameToBlock(frame)
  const windowPos = (block - RAID.w0) / (RAID.w1 - RAID.w0)
  const targetAt = (() => {
    let c = 0
    for (const h of HITS) {
      c += h.buys.reduce((a, b) => a + b.counted, 0)
      if (c >= RAID.target) return h.at
    }
    return Infinity
  })()
  const combo = last && last.buys.length > 1 && frame - last.at < 20 ? last.buys.length : 0

  return (
    <AbsoluteFill className="bg-grape-950">
      <Bg slot="arenaBg" dim={0.4} zoom={[1, 1.06]} />
      <Twinkles count={10} seed={7} />

      {/* sounds: one hit per block, combo on multi-buy blocks, fanfare when the target is crossed */}
      {HITS.map((h) => (
        <Sequence key={h.block} from={h.at} durationInFrames={20} layout="none">
          <Html5Audio src={staticFile(`audio/sfx/${h.buys.length > 1 ? 'combo' : 'hit'}.wav`)} volume={0.55} />
        </Sequence>
      ))}
      {Number.isFinite(targetAt) && (
        <Sequence from={targetAt} durationInFrames={45} layout="none">
          <Html5Audio src={staticFile('audio/sfx/coin.wav')} volume={0.8} />
        </Sequence>
      )}

      {/* header: replay label + boss HP */}
      <div className="absolute inset-x-20 top-10">
        <div className="mb-3 flex items-end justify-between">
          <div className="flex items-center gap-4">
            <Sprite slot="flag" className="h-16 w-16" />
            <div>
              <div className="title-outline-sm text-[44px] leading-none">The Sponsor's Wall</div>
              <div className="mt-1 text-[22px] text-grape-300">{fmt(RAID.wallSize)} tSTAR resting at the cap</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="chip bg-candy-500 text-[20px] text-white shadow-[0_4px_0_#7a1f5f]">
              <span className="inline-block h-3 w-3 rounded-full bg-white" style={{ opacity: Math.floor(frame / 10) % 2 ? 1 : 0.3 }} /> Replay · raid #{RAID.id} · sped up
            </div>
            <div className="font-display text-[48px] text-white">{Math.round(wallLeft * 100)}%</div>
          </div>
        </div>
        <GameBar value={wallLeft} tone="boss" height={52}>
          {fmt(RAID.wallSize - sold)} tSTAR left
        </GameBar>
      </div>

      {/* stage */}
      <div className="absolute inset-x-0 top-[250px] flex h-[470px] justify-center">
        <Crew frame={frame} hitAt={last?.at ?? -99} />
        <div style={{ transform: `translateX(${bossShake}px) rotate(${bossShake * 0.15}deg) translateY(${Math.sin(frame / 12) * 8}px)` }}>
          <Sprite slot={boss} className="h-[420px] w-[420px] drop-shadow-[0_24px_0_rgba(21,18,42,0.55)]" />
        </div>
        {HITS.filter((h) => frame >= h.at && frame - h.at < 32).map((h) => (
          <HitPop key={h.block} hit={h} age={frame - h.at} />
        ))}
        {combo > 1 && (
          <div className="absolute right-40 top-4 text-right" style={{ transform: `rotate(-6deg) scale(${interpolate(frame - last!.at, [0, 6], [1.8, 1], clamp)})` }}>
            <div className="title-outline text-[72px] text-candy-300">COMBO</div>
            <div className="title-outline text-[96px] text-ember-400">x{combo}</div>
          </div>
        )}
      </div>

      {/* footer: target meter and end-window meter */}
      <div className="absolute inset-x-20 bottom-10">
        <div className="mb-3 flex items-end justify-between">
          <div className="flex items-center gap-4">
            <Sprite slot="trophy" className="h-16 w-16" />
            <div>
              <div className="font-display text-[34px] leading-none text-white">Raid target</div>
              <div className="text-[20px] text-grape-300">counted wall buys by seats</div>
            </div>
          </div>
          <div className="text-right">
            <span className="font-display text-[56px] text-ember-400">{fmt(counted)}</span>
            <span className="text-[30px] text-grape-300"> / {fmt(RAID.target)} tUSDC</span>
            <span className="ml-5 text-[24px] font-bold text-cream-100">{buysLanded.length} hits</span>
          </div>
        </div>
        <GameBar value={progress} tone="ember" height={52}>
          {Math.round(Math.min(progress, 9.99) * 100)}%
        </GameBar>
        <div className="mt-5 flex items-center gap-5">
          <div className="w-[260px] text-[20px] font-bold uppercase tracking-widest text-grape-300">
            block {block.toLocaleString()}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-grape-800" style={{ boxShadow: '0 0 0 3px #7a6eb2' }}>
            <div
              className="absolute inset-y-0 right-0"
              style={{ left: `${((RAID.drawFrom - RAID.w0) / (RAID.w1 - RAID.w0)) * 100}%`, background: 'repeating-linear-gradient(-45deg,#e826b1 0 10px,#aa3686 10px 20px)' }}
            />
            <div className="absolute inset-y-0 w-[6px] rounded bg-white" style={{ left: `${Math.min(windowPos, 1) * 100}%` }} />
          </div>
          <div className="w-[300px] text-right text-[20px] font-bold uppercase tracking-widest text-candy-300">danger zone: end is drawn here</div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function HitPop({ hit, age }: { hit: (typeof HITS)[number]; age: number }) {
  const x = 14 + ((hit.i * 37 + hit.block * 13) % 64)
  const y = 2 + ((hit.i * 23 + hit.block * 7) % 46)
  const s = interpolate(age, [0, 5], [0.3, 1], clamp)
  const o = interpolate(age, [20, 32], [1, 0], clamp)
  const dy = interpolate(age, [18, 32], [0, -50], clamp)
  const total = hit.buys.reduce((a, b) => a + b.counted, 0)
  return (
    <div className="absolute z-20" style={{ left: `${x}%`, top: `${y}%`, transform: `translateY(${dy}px) scale(${s})`, opacity: o }}>
      <div className="relative">
        <Sprite slot="spark" className="absolute -left-14 -top-14 h-36 w-36 opacity-90" />
        <StarAvatar tokenId={hit.buys[0].tokenId} size={76} />
        <div className="absolute left-20 top-1 whitespace-nowrap font-display text-[40px] text-ember-300 [-webkit-text-stroke:5px_#2d2250] [paint-order:stroke_fill]">
          +{fmt(total)}
        </div>
      </div>
    </div>
  )
}

/** The crew lunges at the wall on every hit, like StageCrew in the app. */
function Crew({ frame, hitAt }: { frame: number; hitAt: number }) {
  const order: Who[] = ['bear', 'chog', 'fox', 'bunny']
  return (
    <div className="pointer-events-none absolute inset-x-24 bottom-0 z-10 flex items-end justify-between">
      {order.map((w, i) => {
        const left = i < 2
        const t = frame - hitAt - i * 2
        const lunge = t >= 0 && t < 14 ? Math.sin((t / 14) * Math.PI) : 0
        return (
          <div key={w} style={{ transform: `translate(${(left ? 34 : -34) * lunge}px, ${-24 * lunge}px)` }}>
            <div style={{ transform: left ? undefined : 'scaleX(-1)' }}>
              <Mascot who={w} p="attack" style={{ height: 210, width: 'auto' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
