import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREW, pose, src, star, type Pose, type Slot, type Who } from './assets'

/** Frame-driven ports of the app's game primitives (app/src/components/game.tsx, mascots.tsx). */

export function usePop(delay = 0, config = { damping: 12, stiffness: 160 }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config })
}

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export function Sprite({ slot, className = '', style }: { slot: Slot; className?: string; style?: CSSProperties }) {
  return <Img src={src(slot)} className={`pointer-events-none select-none object-contain ${className}`} style={style} />
}

export function Bg({ slot, zoom = [1.08, 1], dim = 0.35, position = 'center' }: { slot: Slot; zoom?: [number, number]; dim?: number; position?: string }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const s = interpolate(frame, [0, durationInFrames], zoom, clamp)
  return (
    <AbsoluteFill>
      <Img src={src(slot)} className="h-full w-full object-cover" style={{ transform: `scale(${s})`, objectPosition: position }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgb(21 18 42 / ${dim}) 0%, rgb(21 18 42 / ${dim * 0.4}) 45%, rgb(21 18 42 / ${Math.min(dim * 2.2, 0.95)}) 100%)` }} />
    </AbsoluteFill>
  )
}

export function Twinkles({ count = 18, seed = 1 }: { count?: number; seed?: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill className="pointer-events-none overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 53 + seed * 17) % 100
        const top = (i * 37 + seed * 11) % 70
        const phase = (frame / 72 + (i % 7) * 0.15) * Math.PI * 2
        const o = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(phase))
        return (
          <span key={i} className="absolute text-ember-300" style={{ left: `${left}%`, top: `${top}%`, opacity: o, transform: `scale(${0.7 + 0.3 * o})`, fontSize: 12 + (i % 4) * 8 }}>
            ✦
          </span>
        )
      })}
    </AbsoluteFill>
  )
}

const FILLS = {
  ember: 'linear-gradient(180deg,#ffd27a,#ff8c42 55%,#fd6b10)',
  candy: 'linear-gradient(180deg,#ff8de0,#e826b1 60%,#aa3686)',
  mint: 'linear-gradient(180deg,#d6ffe9,#a3e3c1 55%,#4fb487)',
  boss: 'linear-gradient(180deg,#ff6b8a,#e8264f 55%,#a3123a)',
}

/** Chunky game bar, `value` 0..1. Markers are 0..1 positions (e.g. the danger zone start). */
export function GameBar({ value, tone = 'ember', height = 48, children, marker }: { value: number; tone?: keyof typeof FILLS; height?: number; children?: ReactNode; marker?: number }) {
  const frame = useCurrentFrame()
  const v = Math.min(Math.max(value, 0), 1)
  return (
    <div className="relative w-full rounded-full p-[6px]" style={{ height, background: '#15122a', boxShadow: '0 0 0 4px #7a6eb2, 0 6px 0 #2d2250' }}>
      <div className="relative h-full w-full overflow-hidden rounded-full bg-grape-800">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v * 100}%`, background: FILLS[tone] }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.18) 0 14px, transparent 14px 28px)', backgroundPosition: `${frame * 1.2}px 0` }}
          />
          <div className="absolute inset-x-3 top-[4px] h-[30%] rounded-full bg-white/35" />
        </div>
        {marker !== undefined && <div className="absolute inset-y-0 w-[4px] bg-white/85" style={{ left: `calc(${marker * 100}% - 2px)` }} />}
        {children && <div className="absolute inset-0 flex items-center justify-center text-[22px] font-extrabold tracking-wide text-white [text-shadow:0_2px_0_#2d2250,0_0_8px_#2d2250]">{children}</div>}
      </div>
    </div>
  )
}

export function Mascot({ who, p = 'cheer', className = '', style }: { who: Who; p?: Pose; className?: string; style?: CSSProperties }) {
  return <Img src={pose(who, p)} className={`pointer-events-none object-contain drop-shadow-[0_10px_8px_rgba(0,0,0,0.4)] ${className}`} style={style} />
}

/** A mascot with a speech bubble, like the app's `Guide`. */
export function Guide({ who, p = 'think', children, delay = 0, size = 220, side = 'right' }: { who: Who; p?: Pose; children: ReactNode; delay?: number; size?: number; side?: 'left' | 'right' }) {
  const m = usePop(delay)
  const b = usePop(delay + 8, { damping: 14, stiffness: 200 })
  const c = CREW[who]
  return (
    <div className={`flex items-end gap-4 ${side === 'left' ? 'flex-row-reverse' : ''}`}>
      <div style={{ transform: `translateY(${(1 - m) * 40}px) scale(${0.85 + 0.15 * m})`, opacity: m }}>
        <Mascot who={who} p={p} style={{ height: size, width: 'auto' }} />
      </div>
      <div
        className="relative mb-10 max-w-[680px] rounded-[36px] border-[4px] bg-cream-100 px-7 py-4 text-[30px] font-semibold leading-snug text-grape-900 shadow-[0_6px_0_#2d2250]"
        style={{ borderColor: c.color, transform: `scale(${0.6 + 0.4 * b})`, opacity: b, transformOrigin: side === 'left' ? 'bottom right' : 'bottom left' }}
      >
        <div className="mb-1 font-display text-[20px] uppercase tracking-widest text-grape-600">{c.name}</div>
        {children}
        <span className={`absolute -bottom-[16px] h-7 w-7 rotate-45 border-b-[4px] border-r-[4px] bg-cream-100 ${side === 'left' ? 'right-10' : 'left-10'}`} style={{ borderColor: c.color }} />
      </div>
    </div>
  )
}

export function StarAvatar({ tokenId, size = 96, legendary = false }: { tokenId: string | null; size?: number; legendary?: boolean }) {
  if (!tokenId)
    return (
      <div className="grid shrink-0 place-items-center rounded-full bg-grape-900" style={{ width: size, height: size, boxShadow: '0 0 0 5px #2d2250, 0 0 0 9px #4a4373' }}>
        <Sprite slot="bot" className="h-[86%] w-[86%] opacity-80" />
      </div>
    )
  return (
    <Img
      src={star(tokenId)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, boxShadow: legendary ? '0 0 0 5px #ffd27a, 0 0 0 10px #ff8c42' : '0 0 0 5px #2d2250, 0 0 0 9px #7a6eb2' }}
    />
  )
}

/** Small uppercase kicker above a big outlined title, the app's section header style. */
export function Title({ kicker, children, delay = 0, size = 120, className = '', tone = 'text-white' }: { kicker?: string; children: ReactNode; delay?: number; size?: number; className?: string; tone?: string }) {
  const p = usePop(delay)
  return (
    <div className={`text-center ${className}`} style={{ transform: `translateY(${(1 - p) * 50}px) rotate(${(1 - p) * -4 - 1.5}deg)`, opacity: p }}>
      {kicker && <div className="chip mb-4 bg-candy-500 text-[22px] text-white shadow-[0_5px_0_#7a1f5f]">{kicker}</div>}
      <div className={`title-outline leading-[1.05] ${tone}`} style={{ fontSize: size }}>
        {children}
      </div>
    </div>
  )
}

/** Springs its children in from a direction. Use instead of calling usePop inside a map. */
export function Pop({ delay = 0, from = 'up', distance = 120, children, className = '', style }: { delay?: number; from?: 'up' | 'down' | 'left' | 'right' | 'scale'; distance?: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  const p = usePop(delay)
  const d = (1 - p) * distance
  const t = { up: `translateY(${d}px)`, down: `translateY(${-d}px)`, left: `translateX(${-d}px)`, right: `translateX(${d}px)`, scale: `scale(${0.4 + 0.6 * p})` }[from]
  return (
    <div className={className} style={{ ...style, transform: t, opacity: Math.min(1, p * 1.4) }}>
      {children}
    </div>
  )
}

export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`panel p-8 ${className}`} style={style}>
      {children}
    </div>
  )
}

/** Shake offset for `frames` after `at`, like the boss shake on every hit. */
export function shake(frame: number, at: number, amp = 14, frames = 12) {
  const t = frame - at
  if (t < 0 || t > frames) return 0
  return Math.sin(t * 2.2) * amp * (1 - t / frames)
}
