/**
 * YouTuber energy layer for the pitch: punch-in zooms on every line, word-by-word captions with the
 * spoken word lit up, keyword stickers that pop in with a sound, and a background that never sits still.
 */
import type { ReactNode } from 'react'
import { AbsoluteFill, Html5Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { clamp } from '../ui'
import { FPS, type Section } from './parts'

const art = (p: string) => staticFile(`art/${p}`)

/** Line starts in frames (from the timed subtitles, so it works for TTS and for his real takes). */
const starts = (s: Section) => s.lines.map((l) => Math.round(l.start * FPS))

/** Zoom that steps on every line, like a jump cut punch-in, with a small overshoot. */
export function usePunch(s: Section) {
  const frame = useCurrentFrame()
  const st = starts(s)
  let i = -1
  for (let k = 0; k < st.length; k++) if (frame >= st[k]) i = k
  if (i < 0) return { scale: 1, x: 0, y: 0 }
  const since = frame - st[i]
  const target = [1, 1.045, 1.02, 1.06][i % 4]
  const prev = i === 0 ? 1 : [1, 1.045, 1.02, 1.06][(i - 1) % 4]
  const p = interpolate(since, [0, 3, 7], [0, 1.15, 1], clamp)
  const scale = prev + (target - prev) * p
  // a nudge off-centre on alternate lines so the zoom reads as a new "shot"
  const x = interpolate(since, [0, 4], [0, 1], clamp) * (i % 2 ? -14 : 10)
  return { scale, x, y: 0 }
}

export function Punch({ s, children }: { s: Section; children: ReactNode }) {
  const { scale, x } = usePunch(s)
  return <AbsoluteFill style={{ transform: `translateX(${x}px) scale(${scale})`, transformOrigin: '50% 45%' }}>{children}</AbsoluteFill>
}

/* ---------------------------------------------------------------- captions */

type Word = { t: string; a: number; b: number }
function words(s: Section): Word[][] {
  // chunks of up to 5 words; words timed across the line by length
  const out: Word[][] = []
  for (const l of s.lines) {
    const ws = l.t.split(/\s+/).filter(Boolean)
    const total = ws.reduce((n, w) => n + w.length + 2, 0)
    let at = l.start
    const timed = ws.map((w) => {
      const d = ((w.length + 2) / total) * (l.end - l.start)
      const r = { t: w, a: at, b: at + d }
      at += d
      return r
    })
    for (let i = 0; i < timed.length; i += 5) {
      const chunk = timed.slice(i, i + 5)
      // keep a dangling one-word chunk with the previous one
      if (chunk.length === 1 && out.length && i > 0) out[out.length - 1].push(chunk[0])
      else out.push(chunk)
    }
  }
  return out
}

const HOT = /^(bots?|snipers?|wall|prize|seats?|hit|HIT|real|five|days|Monad|Kuru|Pyth|Entropy|USDC|target|danger|breaks?|count|nothing|fair|mainnet|passkey|one|Star|Raid|#26|58|580|500)$/i

export function Captions({ s }: { s: Section }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / FPS
  const chunk = words(s).find((c) => t >= c[0].a - 0.05 && t <= c[c.length - 1].b + 0.2)
  if (!chunk) return null
  const startF = Math.round(chunk[0].a * FPS)
  const pop = spring({ frame: frame - startF, fps, config: { damping: 10, stiffness: 260 } })
  return (
    <div className="absolute inset-x-0 bottom-12 z-50 flex justify-center px-40">
      <div className="flex flex-wrap justify-center gap-x-4" style={{ transform: `scale(${0.75 + 0.25 * pop}) rotate(${(1 - pop) * -3}deg)` }}>
        {chunk.map((w, i) => {
          const on = t >= w.a - 0.03
          const now = t >= w.a - 0.03 && t < w.b
          const bare = w.t.replace(/[.,!?:]/g, '')
          const hot = HOT.test(bare)
          const wp = spring({ frame: frame - Math.round(w.a * FPS), fps, config: { damping: 9, stiffness: 300 } })
          return (
            <span
              key={i}
              className="leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 66,
                WebkitTextStroke: '12px #2d2250',
                paintOrder: 'stroke fill',
                textShadow: '0 7px 0 #2d2250, 0 12px 26px rgba(0,0,0,0.35)',
                color: hot ? '#ffb84d' : now ? '#ffe3a3' : '#fff',
                opacity: on ? 1 : 0,
                transform: `translateY(${on ? (1 - wp) * 22 : 22}px) scale(${(now ? 1.12 : 1) * (0.6 + 0.4 * Math.min(1, wp))})`,
                display: 'inline-block',
              }}
            >
              {w.t}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- stickers */

const STICK: [RegExp, string][] = [
  [/\bbots?\b/i, 'bot.webp'],
  [/snipe/i, 'hourglass.webp'],
  [/\bprize|USDC|bounty/i, 'chest_closed.webp'],
  [/\bwall\b/i, 'wall_boss.webp'],
  [/\bseats?\b/i, 'seat_ticket.webp'],
  [/\bhits?\b|HIT/i, 'hit_spark.webp'],
  [/Pyth|drawn|end block/i, 'dice_block.webp'],
  [/breaks|target/i, 'trophy.webp'],
  [/danger/i, 'shield.webp'],
  [/sponsor/i, 'flag_sponsor.webp'],
  [/refund|cancel/i, 'coin.webp'],
  [/fair|nobody/i, 'lock.webp'],
  [/friends|together|community/i, 'medal_gold.webp'],
  [/five days|5 days/i, 'hourglass.webp'],
  [/mainnet|Monad/i, 'orb.webp'],
  [/rolls/i, 'chest_open.webp'],
]

const SPOTS = [
  { x: 1650, y: 70, r: 10 },
  { x: 1500, y: 120, r: -8 },
  { x: 1690, y: 300, r: 6 },
]

export function Stickers({ s, skip = false }: { s: Section; skip?: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (skip) return null
  const items: { src: string; at: number; end: number; k: number }[] = []
  s.lines.forEach((l, i) => {
    const hit = STICK.find(([re]) => re.test(l.t))
    if (!hit) return
    const at = Math.round(l.start * FPS) + 3
    items.push({ src: hit[1], at, end: Math.round(l.end * FPS) + 8, k: i })
  })
  return (
    <>
      {items.map((it, n) => {
        if (frame < it.at - 1 || frame > it.end + 8) return null
        const spot = SPOTS[n % SPOTS.length]
        const p = spring({ frame: frame - it.at, fps, config: { damping: 8, stiffness: 240 } })
        const out = interpolate(frame, [it.end, it.end + 8], [1, 0], clamp)
        const wob = Math.sin((frame - it.at) / 3.5) * 6
        return (
          <div key={n} className="absolute z-[55]" style={{ left: spot.x, top: spot.y, transform: `scale(${p * out}) rotate(${spot.r + wob}deg)` }}>
            <div className="rounded-full bg-cream-100 p-3 shadow-[0_8px_0_#2d2250] ring-[5px] ring-grape-800">
              <Img src={art(it.src)} className="h-[150px] w-[150px] object-contain" />
            </div>
          </div>
        )
      })}
      {items.map((it, n) => (
        <Sequence key={`a${n}`} from={it.at} durationInFrames={20} layout="none">
          <Html5Audio src={staticFile('audio/kit/click.mp3')} volume={0.28} />
        </Sequence>
      ))}
    </>
  )
}

/** Small zoom-in "pop" on the whole frame for each line (sound). */
export function LineTicks({ s }: { s: Section }) {
  return (
    <>
      {starts(s).slice(1).map((f, i) => (
        <Sequence key={i} from={Math.max(0, f - 2)} durationInFrames={18} layout="none">
          <Html5Audio src={staticFile('audio/kit/whoosh.mp3')} volume={0.09} />
        </Sequence>
      ))}
    </>
  )
}

/** Drifting background so even a still slide moves. */
export function useDrift() {
  const frame = useCurrentFrame()
  return { backgroundPosition: `${frame * 1.2}px ${frame * 0.8}px` }
}
