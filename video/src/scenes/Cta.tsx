import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Bg, clamp, Pop, Sprite, Twinkles, usePop } from '../ui'

export const SITE = 'starraid.xyz'

/** Close: why it is fair, and where to play. */
export function Cta() {
  const frame = useCurrentFrame()
  const logo = usePop(40, { damping: 10, stiffness: 140 })
  const pills = [
    { icon: 'shield', text: 'Buys capped at one price on Kuru' },
    { icon: 'dice', text: 'End block drawn by Pyth Entropy' },
    { icon: 'seatTicket', text: 'Prize only for Lil Stars seats' },
    { icon: 'chestClosed', text: 'Paid in USDC, after a hold' },
  ] as const
  return (
    <AbsoluteFill className="bg-grape-950">
      <Bg slot="heroBg" dim={0.7} zoom={[1.02, 1.1]} position="30% 60%" />
      <Twinkles count={16} seed={13} />
      <AbsoluteFill className="items-center justify-center">
        <div className="grid grid-cols-2 gap-5">
          {pills.map((p, i) => (
            <Pop key={p.text} delay={i * 6} from="up" distance={60}>
              <div className="panel flex items-center gap-5 px-7 py-4" style={{ borderRadius: 999 }}>
                <Sprite slot={p.icon} className="h-14 w-14" />
                <div className="text-[30px] font-bold text-white">{p.text}</div>
              </div>
            </Pop>
          ))}
        </div>
        <div className="mt-14" style={{ transform: `scale(${0.5 + 0.5 * logo})`, opacity: logo }}>
          <Sprite slot="wordmarkH" className="h-[220px] w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]" />
        </div>
        <div className="mt-8 flex items-center gap-6" style={{ opacity: interpolate(frame, [56, 68], [0, 1], clamp) }}>
          <div className="btn-primary px-12 py-5 text-[44px]">Join the next raid</div>
          <div className="text-[30px] font-bold text-cream-100">{SITE}</div>
        </div>
        <div className="absolute bottom-8 text-center text-[20px] text-grape-300" style={{ opacity: interpolate(frame, [70, 82], [0, 1], clamp) }}>
          Monad Metropolis 2026 · Built on Kuru, Pyth Entropy and Monad · Lil Stars art by the Lil Stars team
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
