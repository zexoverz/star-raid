import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { fmt, RAID } from '../data'
import { Bg, clamp, Pop, Sprite, Title, Twinkles, usePop } from '../ui'

/** Act 1: a sponsor posts a wall at a price cap and a USDC prize. Terms of real raid #26. */
export function Sponsor() {
  const frame = useCurrentFrame()
  const wall = usePop(14, { damping: 10, stiffness: 120 })
  const bob = Math.sin(frame / 14) * 8
  const terms = [
    { icon: 'flag', label: 'The wall', value: `${fmt(RAID.wallSize)} tSTAR`, sub: 'the sponsor token, resting at one capped price' },
    { icon: 'coin', label: 'The prize', value: `${fmt(RAID.bounty)} tUSDC`, sub: 'only for seats, after a hold' },
    { icon: 'trophy', label: 'The target', value: `${fmt(RAID.target)} tUSDC`, sub: 'counted wall buys by seats' },
    { icon: 'hourglass', label: 'The window', value: `${RAID.w1 - RAID.w0} blocks`, sub: 'about two minutes on Monad' },
  ] as const
  return (
    <AbsoluteFill className="bg-grape-950">
      <Bg slot="arenaBg" dim={0.55} />
      <Twinkles count={10} seed={3} />
      <AbsoluteFill className="flex-row items-center px-28">
        <div className="relative flex w-[760px] flex-col items-center">
          <Title kicker="Step 1 · the sponsor" size={84}>
            Post a wall
          </Title>
          <div className="mt-6" style={{ transform: `translateY(${(1 - wall) * 200 + bob}px) scale(${0.6 + 0.4 * wall})`, opacity: wall }}>
            <Sprite slot="wall" className="h-[520px] w-[520px] drop-shadow-[0_26px_0_rgba(21,18,42,0.55)]" />
          </div>
        </div>
        <div className="ml-12 flex flex-1 flex-col gap-6">
          {terms.map((t, i) => (
            <Pop key={t.label} delay={30 + i * 9} from="right" distance={160}>
              <div className="panel flex items-center gap-6 px-8 py-5">
                <Sprite slot={t.icon} className="h-20 w-20 drop-shadow-[0_5px_0_#2d2250]" />
                <div>
                  <div className="text-[20px] font-bold uppercase tracking-[0.14em] text-grape-300">{t.label}</div>
                  <div className="font-display text-[54px] leading-tight text-white">{t.value}</div>
                  <div className="text-[22px] text-grape-300">{t.sub}</div>
                </div>
              </div>
            </Pop>
          ))}
          <div style={{ opacity: interpolate(frame, [80, 92], [0, 1], clamp) }} className="text-center text-[22px] text-grape-300">
            Terms of testnet raid #{RAID.id}, read from the chain
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
