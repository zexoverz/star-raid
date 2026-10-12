/**
 * "Star Raid (One Star, One Seat)": the sung demo. One original song (ElevenLabs Music, lyrics in
 * src/song/plan.json) sung by the Lil Stars: every lyric line gets its own illustrated scene
 * (public/gen/song, redrawn poses, video-only exception in docs/plan/decisions.md), a Lil Star on the
 * mic, the real app in a phone beside it, and bouncing karaoke words with the actual logos.
 * Every number on screen is read from the chain (raid #26 snapshot in src/data), nothing invented.
 */
import { AbsoluteFill, Html5Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import { RAID } from '../data'
import { clamp, Twinkles } from '../ui'
import lyrics from './lyrics.json'

export const SONG_FPS = 30
export const SONG_TOTAL = Math.round(85 * SONG_FPS)
const BPM = 128
const f = (s: number) => Math.round(s * SONG_FPS)
const L = lyrics.lines as { section: string; t: string; start: number; end: number }[]
const W = lyrics.words as { t: string; s: number; e: number }[]
const line = (i: number) => L[i]
const beatK = (fr: number) => Math.pow(1 - (((fr / SONG_FPS) * BPM) / 60 % 1), 3)

/* ------------------------------------------------------------------ scenes (one per lyric line) */

const SCENE = ['s00_stage', 's01_lobby', 's02_wall', 's03_prize', 's04_clock', 's05_seat', 's06_bots', 's07_tap', 's08_hit', 's09_buy', 's10_cap', 's11_rocket', 's12_curtain', 's13_dice', 's14_count', 's15_break', 's16_crown', 's17_onewall']
const SINGERS = ['bear', 'bunny', 'chog', 'fox'] as const
// who sings each line (lines 0..18); chorus/hooks go to the whole crew
const WHO: (typeof SINGERS[number] | 'all')[] = ['all', 'bunny', 'chog', 'fox', 'bear', 'bunny', 'all', 'bear', 'all', 'chog', 'fox', 'all', 'bunny', 'chog', 'bear', 'all', 'fox', 'all', 'all']
const sceneStart = (i: number) => (i === 0 ? 0 : line(i).start - 0.25)
const sceneEnd = (i: number) => (i + 1 < L.length ? sceneStart(i + 1) : 85)

/* ------------------------------------------------------------------ app footage (phone PiP) */

type Shot = { at: number; src: string; from: number; desk?: boolean }
const SHOTS: Shot[] = [
  { at: line(1).start - 0.3, src: 'rec/phone/lobby.mp4', from: 0.3 },
  { at: line(2).start - 0.2, src: 'rec/sponsor.webm', from: 4, desk: true },
  { at: line(4).start - 0.2, src: 'rec/phone/lobby.mp4', from: 5 },
  { at: line(5).start - 0.2, src: 'rec/phone/practice.mp4', from: 0 },
  { at: line(8).start - 0.2, src: 'rec/phone/practice.mp4', from: 4 },
  { at: line(10).start, src: 'rec/phone/practice.mp4', from: 18 },
  { at: line(12).start - 0.2, src: 'rec/phone/raid.mp4', from: 7.6 },
  { at: line(13).start - 0.2, src: 'rec/phone/raid.mp4', from: 12.5 },
  { at: line(15).start - 0.2, src: 'rec/phone/raid.mp4', from: 22.5 },
  { at: line(16).start, src: 'rec/phone/raid.mp4', from: 1.0 },
  { at: line(18).start - 0.3, src: '', from: 0 },
]

/* ------------------------------------------------------------------ proof chips */

type Chip = { at: number; until: number; title: string; sub: string; icon: string }
const CHIPS: Chip[] = [
  { at: line(2).start + 0.6, until: line(4).start, title: 'Sponsor wall', sub: 'token + price cap + USDC prize', icon: 'art/flag_sponsor.webp' },
  { at: line(5).start + 0.6, until: line(7).start, title: '1 Lil Star = 1 seat', sub: 'no Star, no count. Bots get nothing', icon: 'logos/lilstar.svg' },
  { at: line(9).start + 0.4, until: line(10).start + 0.4, title: 'Every HIT = a real buy', sub: "limit order on Kuru's onchain book", icon: 'logos/kuru.png' },
  { at: line(10).start + 0.6, until: line(12).start, title: 'Never above the cap', sub: 'leftover cancelled + refunded, same tx', icon: 'art/shield.webp' },
  { at: line(13).start + 0.8, until: line(15).start, title: `End block ${Number(RAID.endBlock ?? 0).toLocaleString('en-US')}`, sub: 'drawn by Pyth Entropy after the window', icon: 'logos/pyth.png' },
  { at: line(15).start + 0.4, until: line(18).start - 0.3, title: `Raid #${RAID.id} broke its wall`, sub: `${RAID.countedHits} hits · ${Math.round(RAID.counted)} / ${Math.round(RAID.target)} counted · Monad testnet`, icon: 'art/trophy.webp' },
]

/* ------------------------------------------------------------------ logos inline in the lyrics */

const LOGO: [RegExp, string][] = [
  [/^kuru/i, 'logos/kuru.png'],
  [/^monad/i, 'logos/monad.png'],
  [/^pyth/i, 'logos/pyth.png'],
  [/^usdc/i, 'logos/usdc.svg'],
  [/^stars?[,!]?$/i, 'logos/lilstar.svg'],
  [/^raid!?$/i, 'art/logo.svg'],
  [/^wall/i, 'art/wall_boss.webp'],
  [/^dice/i, 'art/dice_block.webp'],
  [/^seats?[,]?$/i, 'art/seat_ticket.webp'],
  [/^prize/i, 'art/chest_closed.webp'],
  [/^crown/i, 'art/trophy.webp'],
  [/^bots?$/i, 'art/bot.webp'],
  [/^hit[!']?s?$/i, 'art/hit_spark.webp'],
]
const logoFor = (w: string) => LOGO.find(([re]) => re.test(w))?.[1]

/* ------------------------------------------------------------------ pieces */

function Scene({ i, len }: { i: number; len: number }) {
  const fr = useCurrentFrame()
  const dir = i % 2 ? 1 : -1
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 16, stiffness: 120 } })
  const zoom = interpolate(fr, [0, len], [1.12, 1.02], clamp)
  const pan = interpolate(fr, [0, len], [dir * 30, -dir * 30], clamp)
  const punch = 1 + 0.012 * beatK(fr)
  return (
    <AbsoluteFill style={{ transform: `translateX(${(1 - p) * dir * 1920}px) rotate(${(1 - p) * dir * 4}deg)` }}>
      <Img src={staticFile(`gen/song/${SCENE[i]}.webp`)} className="h-full w-full object-cover" style={{ transform: `scale(${zoom * punch}) translateX(${pan}px)` }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(21,18,42,0.15) 0%, rgba(21,18,42,0) 40%, rgba(21,18,42,0.75) 100%)' }} />
    </AbsoluteFill>
  )
}

function Singer({ who, i, at, x, size, mirror }: { who: typeof SINGERS[number]; i: number; at: number; x: number; size: number; mirror?: boolean }) {
  const fr = useCurrentFrame()
  const t = fr / SONG_FPS + at
  const p = spring({ frame: fr - i * 3, fps: SONG_FPS, config: { damping: 10, stiffness: 200 } })
  const k = beatK(fr + i * 4)
  // a little hop on every sung word onset
  const w = W.find((w) => t >= w.s && t < w.s + 0.18)
  const hop = w ? Math.sin(((t - w.s) / 0.18) * Math.PI) * 18 : 0
  const sway = Math.sin((fr + i * 9) / 11) * 4
  return (
    <div className="absolute bottom-[-20px]" style={{ left: x, width: size, height: size, transform: `translateY(${(1 - p) * 500 - hop}px) rotate(${sway}deg) scale(${mirror ? -1 : 1}, ${1 - 0.04 * k}) scaleX(${1 + 0.03 * k})`, transformOrigin: '50% 100%' }}>
      <Img src={staticFile(`gen/song/cut/sing_${who}.webp`)} className="h-full w-full object-contain object-bottom drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]" />
    </div>
  )
}

/** Music notes floating up out of the mic. */
function Notes({ x }: { x: number }) {
  const fr = useCurrentFrame()
  return (
    <>
      {Array.from({ length: 5 }, (_, n) => {
        const life = (fr + n * 13) % 65
        const o = interpolate(life, [0, 8, 50, 65], [0, 1, 1, 0], clamp)
        return (
          <div key={n} className="title-outline-sm absolute text-[54px]" style={{ left: x + Math.sin((life + n * 20) / 9) * 40 + n * 22, bottom: 380 + life * 6, opacity: o, color: ['#ffb84d', '#f7b2d9', '#b6a6ff', '#ffe7a3', '#8ee6c4'][n], transform: `rotate(${Math.sin(life / 7) * 18}deg)` }}>
            {n % 2 ? '♪' : '♫'}
          </div>
        )
      })}
    </>
  )
}

function Crew({ i, at }: { i: number; at: number }) {
  const who = WHO[i]
  if (i === 0) return null
  if (who === 'all') {
    return (
      <>
        {SINGERS.map((s, n) => (
          <Singer key={s} who={s} i={n} at={at} x={-30 + n * 170} size={420} />
        ))}
        <Notes x={300} />
      </>
    )
  }
  return (
    <>
      <Singer who={who} i={0} at={at} x={10} size={560} />
      <Notes x={260} />
    </>
  )
}

function Pip({ s, len }: { s: Shot; len: number }) {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 13, stiffness: 170 } })
  const out = interpolate(fr, [len - 6, len], [0, 1], clamp)
  const bob = Math.sin(fr / 20) * 6
  if (s.desk) {
    return (
      <div className="absolute overflow-hidden rounded-[20px] border-[6px] border-grape-800 bg-black shadow-[0_12px_0_#2d2250,0_30px_60px_rgba(0,0,0,0.5)]" style={{ right: 60, top: 300, width: 720, height: 405, transform: `translateX(${(1 - p) * 900 + out * 60}px) translateY(${bob}px) rotate(${2 - (1 - p) * 8}deg)` }}>
        <OffthreadVideo src={staticFile(s.src)} trimBefore={f(s.from)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  const h = 700
  const w = Math.round(h * (780 / 1688))
  return (
    <div className="absolute" style={{ right: 90, top: 130, width: w + 24, height: h + 24, transform: `translateY(${(1 - p) * 900 + bob - out * 30}px) rotate(${3 + (1 - p) * 10}deg)` }}>
      <div className="absolute inset-0 rounded-[50px] bg-[#0d0b18] shadow-[0_0_0_6px_#ffb84d,0_30px_70px_rgba(0,0,0,0.6)]" />
      <div className="absolute overflow-hidden rounded-[38px]" style={{ left: 12, top: 12, width: w, height: h }}>
        <OffthreadVideo src={staticFile(s.src)} trimBefore={f(s.from)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div className="absolute -top-[30px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-[4px] border-grape-800 bg-ember-400 px-5 py-1 font-display text-[26px] text-white shadow-[0_5px_0_#2d2250]">the real app</div>
    </div>
  )
}

function ProofChip({ c }: { c: Chip }) {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 11, stiffness: 220 } })
  const len = f(c.until - c.at)
  const out = interpolate(fr, [len - 8, len], [0, 1], { ...clamp, easing: (x) => x * x })
  return (
    <div className="flex items-center gap-4 rounded-[24px] border-[5px] border-grape-800 bg-cream-100 px-6 py-3 text-grape-900 shadow-[0_8px_0_#2d2250]" style={{ transform: `translateY(${(1 - p) * -260 - out * 260}px) rotate(-1.5deg)` }}>
      <Img src={staticFile(c.icon)} className="h-[68px] w-[68px] rounded-[14px] object-contain" />
      <div>
        <div className="font-display text-[38px] leading-none">{c.title}</div>
        <div className="mt-1 text-[22px] font-bold text-grape-700">{c.sub}</div>
      </div>
    </div>
  )
}

/** Karaoke: words jump as they are sung, a star ball bounces word to word, logos pop next to their word. */
function Karaoke() {
  const fr = useCurrentFrame()
  const t = fr / SONG_FPS
  const ln = L.find((l) => t >= l.start - 0.2 && t <= l.end + 0.4)
  if (!ln || ln === L[L.length - 1]) return null
  const words = ln.t.split(' ')
  const sung = W.filter((w) => w.s >= ln.start - 0.05 && w.e <= ln.end + 0.05)
  const at = (i: number) => (sung.length === words.length ? sung[i].s : ln.start + ((ln.end - ln.start) * i) / words.length)
  const startF = f(ln.start - 0.2)
  const pop = spring({ frame: fr - startF, fps: SONG_FPS, config: { damping: 11, stiffness: 240 } })
  const cur = words.reduce((c, _, i) => (t >= at(i) - 0.04 ? i : c), -1)
  return (
    <div className="absolute inset-x-0 bottom-[34px] flex justify-center" style={{ paddingLeft: 380, paddingRight: 60 }}>
      <div className="flex max-w-[1480px] flex-wrap items-end justify-center gap-x-[18px] rounded-[30px] border-[4px] border-grape-500 bg-grape-950/80 px-8 pb-3 pt-9" style={{ transform: `scale(${0.8 + 0.2 * pop})`, opacity: Math.min(1, pop * 2) }}>
        {words.map((w, i) => {
          const s = at(i)
          const on = t >= s - 0.04
          const k = (t - s) / 0.28
          const jump = k >= 0 && k <= 1 ? Math.sin(k * Math.PI) * 26 : 0
          const sc = k >= 0 && k <= 1 ? 1 + 0.25 * Math.sin(k * Math.PI) : 1
          const logo = logoFor(w)
          const hot = !!logo
          const lp = spring({ frame: fr - f(s), fps: SONG_FPS, config: { damping: 8, stiffness: 260 } })
          return (
            <span key={i} className="relative inline-flex items-end">
              {i === cur && <Img src={staticFile('logos/lilstar.svg')} className="absolute left-1/2 h-[38px] w-[38px] -translate-x-1/2" style={{ top: -42 - Math.abs(Math.sin(k * Math.PI)) * 18, transform: `rotate(${fr * 6}deg)` }} />}
              <span className="title-outline-sm inline-block text-[48px] leading-tight" style={{ color: on ? (hot ? '#ffb84d' : '#ffffff') : 'rgba(255,255,255,0.35)', transform: `translateY(${-jump}px) scale(${sc}) rotate(${jump ? (i % 2 ? 4 : -4) : 0}deg)` }}>
                {w}
              </span>
              {logo && on && <Img src={staticFile(logo)} className="mb-2 ml-1 h-[52px] w-[52px] rounded-[10px] object-contain drop-shadow-[0_4px_0_#2d2250]" style={{ transform: `scale(${lp}) rotate(${(1 - lp) * 90}deg) translateY(${-jump * 0.6}px)` }} />}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function TitleCard() {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr - 50, fps: SONG_FPS, config: { damping: 9, stiffness: 140 } })
  return (
    <AbsoluteFill className="items-center justify-start pt-[40px]">
      <Img src={staticFile('art/wordmark.svg')} className="h-[380px] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)]" style={{ transform: `scale(${(0.3 + 0.7 * p) * (1 + 0.03 * beatK(fr))}) rotate(${(1 - p) * -14}deg)`, opacity: Math.min(1, p * 1.5) }} />
      <div className="mt-2 flex items-center gap-4 rounded-full border-[4px] border-grape-800 bg-cream-100 px-6 py-2 font-display text-[34px] text-grape-900 shadow-[0_6px_0_#2d2250]" style={{ opacity: interpolate(fr, [80, 92], [0, 1], clamp), transform: `translateY(${interpolate(fr, [80, 92], [40, 0], clamp)}px)` }}>
        <Img src={staticFile('art/lilstars/logo.webp')} className="h-[52px] w-[52px] rounded-full" /> the Lil Stars sing the demo
      </div>
    </AbsoluteFill>
  )
}

function EndCard() {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 10, stiffness: 160 } })
  return (
    <AbsoluteFill className="items-center justify-start pt-[50px]">
      <Img src={staticFile('art/wordmark-h.svg')} className="h-[200px] w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.6)]" style={{ transform: `scale(${p * (1 + 0.03 * beatK(fr))})` }} />
      <div className="mt-4 rounded-full border-[5px] border-grape-800 bg-ember-400 px-10 py-2 font-display text-[66px] text-white shadow-[0_8px_0_#2d2250]" style={{ transform: `scale(${spring({ frame: fr - 8, fps: SONG_FPS, config: { damping: 9, stiffness: 220 } })})` }}>
        starraid.xyz
      </div>
      <div className="mt-5 flex items-center gap-5 rounded-[24px] bg-grape-950/75 px-7 py-3 text-[28px] font-bold text-cream-100" style={{ opacity: interpolate(fr, [14, 24], [0, 1], clamp) }}>
        {[['logos/monad.png', 'Monad'], ['logos/kuru.png', 'Kuru'], ['logos/pyth.png', 'Pyth Entropy'], ['art/lilstars/logo.webp', 'Lil Stars']].map(([src, label], n) => (
          <span key={label} className="flex items-center gap-2" style={{ transform: `translateY(${-Math.abs(Math.sin((fr - n * 5) / 6)) * 8}px)` }}>
            <Img src={staticFile(src)} className="h-[44px] w-[44px] rounded-[10px] object-contain" /> {label}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-full bg-grape-950/75 px-5 py-1 text-[20px] text-grape-200" style={{ opacity: interpolate(fr, [20, 30], [0, 1], clamp) }}>
        Lil Stars by the Lil Stars team (lilstars.xyz) · redrawn poses are fan art for this video · song made with ElevenLabs Music
      </div>
    </AbsoluteFill>
  )
}

export function SongDemo() {
  const endAt = sceneStart(18)
  return (
    <AbsoluteFill style={{ background: '#15122a' }}>
      {/* scenes */}
      {L.map((_, i) => {
        const idx = Math.min(i, SCENE.length - 1)
        const from = f(sceneStart(i))
        const len = f(sceneEnd(i)) - from
        return (
          <Sequence key={`s${i}`} from={from} durationInFrames={len} layout="none">
            <Scene i={i === 18 ? 0 : idx} len={len} />
            <Sequence from={0} durationInFrames={20} layout="none">
              <Html5Audio src={staticFile('audio/kit/whoosh.mp3')} volume={0.1} />
            </Sequence>
          </Sequence>
        )
      })}
      <Twinkles count={14} seed={11} />
      {/* real app */}
      {SHOTS.map((s, i) => {
        if (!s.src) return null
        const from = f(s.at)
        const len = f(SHOTS[i + 1].at) - from
        return (
          <Sequence key={`p${i}`} from={from} durationInFrames={len} layout="none">
            <Pip s={s} len={len} />
          </Sequence>
        )
      })}
      {/* singers */}
      {L.map((_, i) => {
        const from = f(sceneStart(i))
        return (
          <Sequence key={`c${i}`} from={from} durationInFrames={f(sceneEnd(i)) - from} layout="none">
            <Crew i={i} at={sceneStart(i)} />
          </Sequence>
        )
      })}
      <Sequence durationInFrames={f(line(1).start - 0.25)} layout="none">
        <TitleCard />
      </Sequence>
      <Sequence from={f(endAt)} layout="none">
        <EndCard />
      </Sequence>
      <div className="absolute left-[60px] top-[40px] flex w-[900px] flex-col items-start gap-4">
        {CHIPS.map((c, i) => (
          <Sequence key={i} from={f(c.at)} durationInFrames={f(c.until - c.at)} layout="none">
            <ProofChip c={c} />
            <Html5Audio src={staticFile('audio/kit/card.mp3')} volume={0.18} />
          </Sequence>
        ))}
      </div>
      <Karaoke />
      <Html5Audio src={staticFile('audio/song/star-raid-song.mp3')} volume={(fr) => interpolate(fr, [SONG_TOTAL - 45, SONG_TOTAL], [0.7, 0], clamp)} />
    </AbsoluteFill>
  )
}
