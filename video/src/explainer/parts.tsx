import type { ReactNode } from 'react'
import { AbsoluteFill, Html5Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { SITE } from '../scenes/Cta'
import { clamp, Twinkles, usePop } from '../ui'
import lines from './vo.json'
import durations from './vo-durations.json'

export const FPS = 30
export const LEAD = 12 // frames of silence before each line
export const TAIL = 24 // frames after it
export type LineId = keyof typeof durations
export const voFrames = (id: LineId) => Math.ceil(durations[id] * FPS)
export const sceneFrames = (id: LineId) => LEAD + voFrames(id) + TAIL
const text = (id: LineId) => lines.find((l) => l.id === id)!.text

/** Plays the line and shows it as subtitles, one sentence at a time, timed by length. */
export function Voice({ id }: { id: LineId }) {
  const frame = useCurrentFrame() - LEAD
  const total = voFrames(id)
  const parts = text(id).match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text(id)]
  const weights = parts.map((p) => p.length + 12)
  const sum = weights.reduce((a, b) => a + b, 0)
  let at = 0
  let current = ''
  for (let i = 0; i < parts.length; i++) {
    const len = (weights[i] / sum) * total
    if (frame >= at && frame < at + len) current = parts[i]
    at += len
  }
  return (
    <>
      <Sequence from={LEAD} layout="none">
        <Html5Audio src={staticFile(`audio/vo/${id}.mp3`)} />
      </Sequence>
      {current && (
        <div className="absolute inset-x-0 bottom-7 z-50 flex justify-center px-40">
          <div className="rounded-2xl bg-grape-950/85 px-6 py-2.5 text-center text-[30px] font-semibold leading-snug text-cream-100 shadow-[0_4px_0_#2d2250]">{current}</div>
        </div>
      )}
    </>
  )
}

/** Section chip, top left, like the app's phase chips. */
export function Chapter({ n, label }: { n: number; label: string }) {
  const p = usePop(4)
  return (
    <div className="absolute left-10 top-8 z-40 flex items-center gap-3" style={{ transform: `translateX(${(1 - p) * -60}px)`, opacity: p }}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-candy-500 font-display text-[26px] text-white shadow-[0_4px_0_#7a1f5f]">{n}</span>
      <span className="title-outline-sm text-[34px]">{label}</span>
    </div>
  )
}

/** A screen recording inside a browser window, with a slow push-in. */
export function Screen({
  src,
  from = 0,
  rate = 1,
  zoom = [1, 1.06],
  origin = '50% 40%',
  tag,
  path = '',
  segments,
}: {
  src: string
  from?: number
  rate?: number
  zoom?: [number, number]
  origin?: string
  tag?: string
  path?: string
  /** Play several cuts of the same clip back to back inside one window: [start s, end s, rate]. */
  segments?: [number, number, number][]
}) {
  const frame = useCurrentFrame()
  const { durationInFrames, fps } = useVideoConfig()
  const z = interpolate(frame, [0, durationInFrames], zoom, clamp)
  const enter = usePop(0, { damping: 200, stiffness: 120 })
  return (
    <AbsoluteFill className="items-center justify-center bg-grape-950">
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 0%, rgb(232 38 177 / 0.25), transparent 60%), radial-gradient(ellipse at 50% 110%, rgb(255 140 66 / 0.25), transparent 60%)' }} />
      <Twinkles count={10} seed={21} />
      <div
        className="relative overflow-hidden rounded-[28px] border-[4px] border-grape-500 bg-grape-900 shadow-[0_10px_0_#2d2250,0_30px_80px_rgba(0,0,0,0.5)]"
        style={{ width: 1600, height: 950, transform: `translateY(${(1 - enter) * 60}px) scale(${0.96 + 0.04 * enter})` }}
      >
        <div className="flex h-[50px] items-center gap-2 bg-grape-800 px-5">
          {['#ff6b8a', '#ffb84d', '#a3e3c1'].map((c) => (
            <span key={c} className="h-4 w-4 rounded-full" style={{ background: c }} />
          ))}
          <div className="ml-4 flex-1 rounded-full bg-grape-950/70 px-5 py-1 text-[18px] text-grape-300">
            <span className="text-mint">🔒</span> <span className="text-cream-100">{SITE}</span>
            {path}
          </div>
          {tag && <span className="chip bg-candy-500 text-[16px] text-white">{tag}</span>}
        </div>
        <div className="relative h-[900px] w-full overflow-hidden">
          <div style={{ width: 1600, height: 900, transform: `scale(${z})`, transformOrigin: origin }}>
            {segments ? (
              segments.map(([a, b, r], i) => {
                const start = segments.slice(0, i).reduce((acc, [x, y, q]) => acc + Math.round(((y - x) / q) * fps), 0)
                const len = Math.round(((b - a) / r) * fps)
                return (
                  <Sequence key={i} from={start} durationInFrames={i === segments.length - 1 ? undefined : len} layout="none">
                    <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(a * fps)} playbackRate={r} muted style={{ position: 'absolute', width: 1600, height: 900 }} />
                  </Sequence>
                )
              })
            ) : (
              <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(from * fps)} playbackRate={rate} muted style={{ width: 1600, height: 900 }} />
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** A callout bubble that pops in at `at` and leaves at `until` (frames). */
export function Callout({ at, until, x, y, children, tone = 'ember' }: { at: number; until?: number; x: number; y: number; children: ReactNode; tone?: 'ember' | 'candy' | 'mint' }) {
  const frame = useCurrentFrame()
  const p = usePop(at, { damping: 12, stiffness: 200 })
  const out = until ? interpolate(frame, [until, until + 8], [1, 0], clamp) : 1
  if (frame < at) return null
  const bg = { ember: 'linear-gradient(180deg,#ffb84d,#ff8c42 55%,#fd6b10)', candy: 'linear-gradient(180deg,#ff5cd0,#e826b1 60%,#aa3686)', mint: 'linear-gradient(180deg,#d6ffe9,#a3e3c1)' }[tone]
  return (
    <div className="absolute z-40" style={{ left: x, top: y, transform: `scale(${p}) rotate(-2deg)`, opacity: out, transformOrigin: 'left center' }}>
      <div className={`rounded-3xl px-6 py-3 font-display text-[30px] shadow-[0_6px_0_#2d2250,0_14px_30px_rgba(0,0,0,0.4)] ${tone === 'mint' ? 'text-grape-900' : 'text-white'}`} style={{ background: bg, border: '4px solid #2d2250' }}>
        {children}
      </div>
    </div>
  )
}

export function Scene({ id, children }: { id: LineId; children: ReactNode }) {
  return (
    <AbsoluteFill className="bg-grape-950">
      {children}
      <Voice id={id} />
    </AbsoluteFill>
  )
}
