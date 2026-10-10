import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { AbsoluteFill, Html5Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { pose } from '../assets'
import { clamp } from '../ui'
import timing from './timing.json'

export const FPS = 30
export type Section = (typeof timing)[number]
export const sec = (id: string) => timing.find((s) => s.id === id)!
export const frames = (s: Section) => Math.round(s.dur * FPS)
/** Frame of the i-th scripted line in a section (falls back to the last cue). */
export const cue = (s: Section, i: number) => Math.round((s.cues[Math.min(i, s.cues.length - 1)] ?? 0) * FPS)

export function usePopAt(at: number, config = { damping: 12, stiffness: 170 }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - at, fps, config })
}

/* ----------------------------------------------------------------- face slot */

const FULL = { x: 0, y: 0, w: 1920, h: 1080, r: 0 }
const CORNER = { x: 1920 - 70 - 300, y: 1080 - 190 - 300, w: 300, h: 300, r: 150 }

/**
 * zexoverz on camera. One element for the whole section so his voice never cuts when the layout
 * changes: `amount` 0 = full frame, 1 = circle in the corner. Without a recording it shows a
 * labelled placeholder (crew art, file name) so the cut can be reviewed before filming.
 */
/** 'placeholder' shows a labelled camera slot; 'off' renders the cut without him (branded backdrop). */
export const FaceMode = createContext<'placeholder' | 'off'>('placeholder')

export function Face({ s, amount }: { s: Section; amount: number }) {
  const k = Math.min(Math.max(amount, 0), 1)
  const mode = useContext(FaceMode)
  if (mode === 'off' && !s.video) {
    // no recording: full-frame sections get the hero street, the corner circle simply isn't there
    if (k >= 0.99) return null
    return (
      <div className="absolute inset-0 z-[5]" style={{ opacity: 1 - k }}>
        <Backdrop title={BACKDROP_TITLE[s.id]} />
      </div>
    )
  }
  const box = {
    left: interpolate(k, [0, 1], [FULL.x, CORNER.x]),
    top: interpolate(k, [0, 1], [FULL.y, CORNER.y]),
    width: interpolate(k, [0, 1], [FULL.w, CORNER.w]),
    height: interpolate(k, [0, 1], [FULL.h, CORNER.h]),
    borderRadius: interpolate(k, [0, 1], [FULL.r, CORNER.r]),
  }
  const ring = k > 0.02 ? { boxShadow: `0 0 0 ${8 * k}px #fff4e4, 0 0 0 ${14 * k}px #2d2250, 0 ${14 * k}px 30px rgba(0,0,0,0.45)` } : {}
  return (
    <div className="absolute z-30 overflow-hidden" style={{ ...box, ...ring }}>
      {s.video && s.media ? <Take s={s} /> : <FacePlaceholder s={s} corner={k} />}
    </div>
  )
}

/** Sections that are only his face get a big title instead when rendered without him. */
const BACKDROP_TITLE: Record<string, string[]> = {
  hook: ['A token launch', 'that plays like a boss fight'],
  close: ['One Star.', 'One seat.', 'One wall.'],
}

function Backdrop({ title }: { title?: string[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill className="bg-grape-950">
      <Img src={staticFile('art/hero_scene.webp')} className="h-full w-full object-cover" style={{ objectPosition: '30% 60%', transform: `scale(${1.04 + frame * 0.0004})` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgb(21 18 42 / 0.55), rgb(21 18 42 / 0.25) 50%, rgb(21 18 42 / 0.75))' }} />
      {title && (
        <AbsoluteFill className="items-center justify-center pb-24">
          {title.map((t, i) => {
            const p = spring({ frame: frame - 6 - i * 12, fps, config: { damping: 11, stiffness: 170 } })
            return (
              <div key={t} className="title-outline text-center leading-[1.05]" style={{ fontSize: i === 0 && title.length === 2 ? 120 : 104, color: i === title.length - 1 ? '#ffb84d' : '#fff', transform: `translateY(${(1 - p) * 60}px) rotate(-2deg)`, opacity: Math.min(1, p * 1.5) }}>
                {t}
              </div>
            )
          })}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

/** Plays his take, jump-cut: each spoken segment back to back, pauses dropped, speed untouched. */
function Take({ s, muted = false }: { s: Section; muted?: boolean }) {
  const segs = (s as { segments?: { from: number; len: number }[] | null }).segments
  if (!s.media) return null
  if (!segs?.length) return <OffthreadVideo src={staticFile(s.media)} trimBefore={Math.round((s.trim ?? 0) * FPS)} muted={muted} className="h-full w-full object-cover" />
  let at = 0
  return (
    <>
      {segs.map((g, i) => {
        const from = at
        const len = Math.max(1, Math.round(g.len * FPS))
        at += len
        return (
          <Sequence key={i} from={from} durationInFrames={len} layout="none">
            <OffthreadVideo src={staticFile(s.media!)} trimBefore={Math.round(g.from * FPS)} muted={muted} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          </Sequence>
        )
      })}
    </>
  )
}

function FacePlaceholder({ s, corner }: { s: Section; corner: number }) {
  const frame = useCurrentFrame()
  const file = (s.media ?? '').replace('pitch-vo/', '').replace('.mp3', '')
  return (
    <AbsoluteFill className="items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 35%, #4a4373, #221d3d 70%)' }}>
      <Img src={pose('fox', 'think')} className="object-contain" style={{ height: `${interpolate(corner, [0, 1], [62, 80])}%`, transform: `translateY(${Math.sin(frame / 12) * 6}px)` }} />
      {corner < 0.5 && (
        <div className="absolute inset-x-0 top-[8%] flex flex-col items-center" style={{ opacity: 1 - corner * 2 }}>
          <div className="chip bg-candy-500 text-[26px] text-white shadow-[0_5px_0_#7a1f5f]">📷 zexoverz on camera</div>
          <div className="mt-3 rounded-full bg-black/40 px-5 py-1.5 font-mono text-[24px] text-cream-100">face/{file.replace(/^/, '')}.mp4</div>
        </div>
      )}
      {/* corner brackets so it reads as a camera frame */}
      {corner < 0.5 &&
        [
          'left-12 top-12 border-l-[10px] border-t-[10px]',
          'right-12 top-12 border-r-[10px] border-t-[10px]',
          'left-12 bottom-12 border-b-[10px] border-l-[10px]',
          'right-12 bottom-12 border-b-[10px] border-r-[10px]',
        ].map((c) => <div key={c} className={`absolute h-20 w-20 rounded-md border-cream-100/70 ${c}`} style={{ opacity: 1 - corner * 2 }} />)}
    </AbsoluteFill>
  )
}

/* -------------------------------------------------------------- voice, subs */

/** The section's voice: his clip's own audio when it is a video, else the placeholder read. */
export function Voice({ s }: { s: Section }) {
  if (!s.media) return null
  if (s.video) {
    // face sections play audio through <Face>; voice-only sections play the take hidden, for its sound
    return s.face === 'none' ? (
      <div className="pointer-events-none absolute h-px w-px opacity-0">
        <Take s={s} />
      </div>
    ) : null
  }
  return (
    <Sequence from={Math.round((s.lead ?? 0) * FPS)} layout="none">
      <Html5Audio src={staticFile(s.media)} />
    </Sequence>
  )
}

export function Subtitles({ s }: { s: Section }) {
  const t = useCurrentFrame() / FPS
  const line = s.lines.find((l) => t >= l.start - 0.05 && t <= l.end + 0.25)
  if (!line) return null
  return (
    <div className="absolute inset-x-0 bottom-9 z-50 flex justify-center px-64">
      <div className="rounded-2xl bg-grape-950/88 px-6 py-2.5 text-center text-[32px] font-semibold leading-snug text-cream-100 shadow-[0_4px_0_#2d2250]">{line.t}</div>
    </div>
  )
}

/* ------------------------------------------------------------ slide pieces */

export const BG = {
  checker: { background: 'repeating-conic-gradient(#ffd27a 0% 25%, #fff4e4 0% 50%) 0 0 / 120px 120px' },
  lavender: { background: 'linear-gradient(180deg,#ece8ff,#d8d0ff)' },
  sky: { background: 'linear-gradient(180deg,#b6d6f7,#8fbcef)' },
  mint: { background: 'linear-gradient(180deg,#d6ffe9,#a3e3c1)' },
  grape: { background: 'radial-gradient(ellipse at 50% 20%, #4a4373, #15122a 70%)' },
} as const

/* ------------------------------------------------------------- motion sound */

export type SfxKind = 'slide-in' | 'slide-out' | 'card' | 'photo' | 'boing' | 'stamp' | 'sparkle' | 'scribble' | 'whoosh' | 'click' | 'coin' | 'hit' | 'join' | 'reveal' | 'combo' | 'tick' | 'victory' | 'defeat'
const SFX_VOL: Partial<Record<SfxKind, number>> = { 'slide-in': 0.32, 'slide-out': 0.22, card: 0.3, photo: 0.38, boing: 0.3, stamp: 0.4, sparkle: 0.22, scribble: 0.18, whoosh: 0.25, click: 0.28 }

/** One kit sound at a frame (relative to the current Sequence). Negative or NaN frames are skipped. */
export function Sfx({ at, kind, volume }: { at: number; kind: SfxKind; volume?: number }) {
  if (!Number.isFinite(at) || at < 0) return null
  return (
    <Sequence from={Math.round(at)} durationInFrames={24} layout="none">
      <Html5Audio src={staticFile(`audio/kit/${kind}.mp3`)} volume={volume ?? SFX_VOL[kind] ?? 0.3} />
    </Sequence>
  )
}

/** Sounds for an element that enters at `at` and (optionally) leaves at `out`. */
export function InOut({ at, out, kind = 'slide-in' }: { at: number; out?: number; kind?: SfxKind }) {
  return (
    <>
      <Sfx at={at} kind={kind} />
      {out !== undefined && <Sfx at={out - 4} kind="slide-out" />}
    </>
  )
}

/** Sticker card: thick dark outline and a hard drop shadow, the reference's slide look in our palette. */
export function Sticker({ at, children, className = '', style, tilt = 0, from = 'up', sfx = true }: { at: number; children: ReactNode; className?: string; style?: CSSProperties; tilt?: number; from?: 'up' | 'left' | 'right' | 'pop'; sfx?: boolean }) {
  const p = usePopAt(at)
  const frame = useCurrentFrame()
  const sound = sfx ? <Sfx at={at} kind={from === 'pop' ? 'boing' : 'slide-in'} /> : null
  if (frame < at) return sound
  const d = (1 - p) * 140
  const move = { up: `translateY(${d}px)`, left: `translateX(${-d}px)`, right: `translateX(${d}px)`, pop: `scale(${0.3 + 0.7 * p})` }[from]
  return (
    <>
      {sound}
      <div
        className={`rounded-[28px] border-[5px] border-grape-800 bg-cream-100 text-grape-900 shadow-[0_9px_0_#2d2250] ${className}`}
        style={{ ...style, transform: `${move} rotate(${tilt}deg)`, opacity: Math.min(1, p * 1.5) }}
      >
        {children}
      </div>
    </>
  )
}

/** Big outlined word that slams in, like the reference's "5 DAYS" and "LIQUIDITY". */
export function Slam({ at, children, className = '', color = '#ffb84d', size = 150 }: { at: number; children: ReactNode; className?: string; color?: string; size?: number }) {
  const frame = useCurrentFrame()
  const p = usePopAt(at, { damping: 9, stiffness: 220 })
  const sound = <Sfx at={at} kind="stamp" />
  if (frame < at) return sound
  return (
    <>
      {sound}
      <div className={`title-outline z-40 leading-none ${className}`} style={{ fontSize: size, color, transform: `scale(${interpolate(p, [0, 1], [2.2, 1])}) rotate(-4deg)`, opacity: Math.min(1, p * 2) }}>
        {children}
      </div>
    </>
  )
}

/** A phone with a screen recording; `cuts` plays several moments of the same or different clips. */
export function Phone({ cuts, height = 860, className = '', style }: { cuts: { src: string; from: number; at: number; until?: number }[]; height?: number; className?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame()
  const w = Math.round(height * (780 / 1688))
  const enter = usePopAt(0, { damping: 16, stiffness: 120 })
  return (
    <div className={`relative ${className}`} style={{ ...style, width: w + 36, height: height + 36, transform: `translateY(${(1 - enter) * 80}px)` }}>
      <div className="absolute inset-0 rounded-[64px] bg-[#0d0b18] shadow-[0_0_0_6px_#4a4373,0_24px_60px_rgba(0,0,0,0.5)]" />
      <div className="absolute overflow-hidden rounded-[48px] bg-grape-950" style={{ left: 18, top: 18, width: w, height }}>
        {cuts.map((c, i) => {
          const until = c.until ?? cuts[i + 1]?.at ?? 1e9
          if (frame < c.at - 2 || frame > until + 2) return null
          return (
            <Sequence key={i} from={c.at} durationInFrames={until - c.at + 2} layout="none">
              <OffthreadVideo src={staticFile(c.src)} trimBefore={Math.round(c.from * FPS)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </Sequence>
          )
        })}
      </div>
    </div>
  )
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`chip border-[3px] border-grape-800 bg-cream-100 px-5 py-1.5 text-[26px] text-grape-900 shadow-[0_4px_0_#2d2250] ${className}`}>{children}</span>
}

export const ease = (frame: number, a: number, b: number) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 })
