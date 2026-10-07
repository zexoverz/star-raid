import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Bg, clamp, Sprite, Twinkles, usePop } from '../ui'

/** Cold open on the hero street: the crew faces the wall, the wordmark lands. */
export function Hook() {
  const frame = useCurrentFrame()
  const logo = usePop(10, { damping: 9, stiffness: 140 })
  const tag = usePop(34)
  const sub = interpolate(frame, [52, 66], [0, 1], clamp)
  return (
    <AbsoluteFill className="bg-grape-950">
      <Bg slot="heroBg" zoom={[1.15, 1.02]} dim={0.25} position="30% 60%" />
      <Twinkles count={14} />
      <AbsoluteFill className="items-center justify-start pt-16">
        <div style={{ transform: `scale(${0.4 + 0.6 * logo}) rotate(${(1 - logo) * -12}deg)`, opacity: logo }}>
          <Sprite slot="wordmark" className="h-[440px] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)]" />
        </div>
      </AbsoluteFill>
      <AbsoluteFill className="items-center justify-end pb-24">
        <div className="title-outline text-[92px] leading-none" style={{ transform: `translateY(${(1 - tag) * 60}px) rotate(-2deg)`, opacity: tag }}>
          One Star. One seat. <span className="text-ember-400">One wall.</span>
        </div>
        <div className="mt-6 text-[34px] font-bold text-cream-100" style={{ opacity: sub, textShadow: '0 3px 0 #2d2250' }}>
          A co-op raid on Kuru's on-chain order book, on Monad
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
