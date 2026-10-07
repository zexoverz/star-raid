import { AbsoluteFill, Html5Audio, interpolate, random, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { RAID } from '../data'
import { Bg, clamp, Guide, Pop, Sprite, Title, usePop } from '../ui'

/** Act 4: the window closes, Pyth Entropy draws the end block, every hit is judged against it. */
const ROLL_END = 70
export function Draw() {
  const frame = useCurrentFrame()
  const rolling = frame < ROLL_END
  const lo = RAID.drawFrom
  const hi = RAID.w1
  const shown = rolling ? lo + Math.floor(random(`roll-${Math.floor(frame / 2)}`) * (hi - lo + 1)) : RAID.endBlock
  const land = usePop(ROLL_END, { damping: 8, stiffness: 180 })
  const dice = rolling ? Math.sin(frame / 2) * 14 : 0
  const range = (RAID.endBlock - lo) / (hi - lo)
  const judge = interpolate(frame, [ROLL_END + 30, ROLL_END + 80], [0, RAID.countedHits], clamp)
  return (
    <AbsoluteFill className="bg-grape-950">
      <Bg slot="stageBg" dim={0.45} zoom={[1.05, 1]} />
      <Sequence from={0} durationInFrames={40} layout="none">
        <Html5Audio src={staticFile('audio/kit/drum.mp3')} volume={0.9} />
      </Sequence>
      <Sequence from={ROLL_END} durationInFrames={30} layout="none">
        <Html5Audio src={staticFile('audio/kit/reveal.mp3')} volume={0.9} />
      </Sequence>
      <AbsoluteFill className="items-center pt-20">
        <Title kicker="Step 3 · the draw" size={80}>
          When does the raid <span className="text-candy-300">really</span> end?
        </Title>
        <div className="mt-6 max-w-[1200px] text-center text-[30px] font-semibold text-cream-100" style={{ textShadow: '0 3px 0 #2d2250' }}>
          Nobody knows until the window closes. Pyth Entropy draws the end block between {lo.toLocaleString()} and {hi.toLocaleString()}. Hits after it do not count.
        </div>
        <div className="mt-12 flex items-center gap-10">
          <Sprite slot="dice" className="h-48 w-48" style={{ transform: `rotate(${dice}deg) scale(${rolling ? 1 : 0.9 + 0.1 * land})` }} />
          <div>
            <div className="title-outline-sm text-[44px] text-candy-300">End block</div>
            <div
              className="title-outline text-[150px] leading-none"
              style={{ color: rolling ? '#b8aee6' : '#ffb84d', transform: `scale(${rolling ? 1 : 0.8 + 0.2 * land})`, transformOrigin: 'left center' }}
            >
              {shown.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="relative mt-10 h-8 w-[1100px] rounded-full bg-grape-800" style={{ boxShadow: '0 0 0 4px #7a6eb2' }}>
          <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-linear-gradient(-45deg,#e826b1 0 12px,#aa3686 12px 24px)', opacity: 0.6 }} />
          {!rolling && <div className="absolute -top-4 h-16 w-3 rounded bg-ember-400 shadow-[0_0_20px_#ffb84d]" style={{ left: `calc(${range * 100}% - 6px)`, opacity: land }} />}
        </div>
        <Pop delay={ROLL_END + 24} className="mt-10">
          <div className="flex gap-6">
            <div className="chip bg-mint px-8 py-3 text-[30px] text-grape-900">✓ {Math.round(judge)} hits before the end · counted</div>
            <div className="chip bg-grape-700 px-8 py-3 text-[30px] text-grape-100">{RAID.lateHits} after · not counted</div>
          </div>
        </Pop>
      </AbsoluteFill>
      <div className="absolute bottom-6 right-12">
        <Guide who="bunny" p="watch" delay={10} size={170} side="left">
          Nobody can snipe the last block, not even us!
        </Guide>
      </div>
    </AbsoluteFill>
  )
}
