/**
 * "Star Raid (One Star, One Seat)": the sung demo. One original song (ElevenLabs Music, lyrics in
 * src/song/plan.json) over the real app recordings, with karaoke lyrics and on-chain proof chips.
 * Every number on screen is read from the chain (raid #26 snapshot in src/data), nothing invented.
 */
import { AbsoluteFill, Html5Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import { RAID } from '../data'
import { clamp, Twinkles } from '../ui'
import lyrics from './lyrics.json'

export const SONG_FPS = 30
export const SONG_TOTAL = Math.round(85 * SONG_FPS)
const f = (s: number) => Math.round(s * SONG_FPS)
const L = lyrics.lines as { section: string; t: string; start: number; end: number }[]
const W = lyrics.words as { t: string; s: number; e: number }[]
const line = (i: number) => L[i]

/* ------------------------------------------------------------------ shots */

type Shot = { at: number; src: string; from: number; kind: 'phone' | 'desk' | 'card'; card?: 'title' | 'end' }
// at = song second the shot starts; from = second into the recording
const SHOTS: Shot[] = [
  { at: 0, src: '', from: 0, kind: 'card', card: 'title' },
  { at: line(1).start - 0.3, src: 'rec/phone/lobby.mp4', from: 0.3, kind: 'phone' }, // open up the lobby
  { at: line(2).start - 0.2, src: 'rec/sponsor.webm', from: 4, kind: 'desk' }, // a sponsor builds a wall
  { at: line(4).start - 0.2, src: 'rec/phone/lobby.mp4', from: 5, kind: 'phone' }, // countdown
  { at: line(5).start - 0.2, src: 'rec/phone/practice.mp4', from: 0, kind: 'phone' }, // bring your Lil Star / set up once
  { at: line(8).start - 0.2, src: 'rec/phone/practice.mp4', from: 4, kind: 'phone' }, // HIT HIT HIT
  { at: line(10).start, src: 'rec/phone/practice.mp4', from: 18, kind: 'phone' }, // capped, leftovers back
  { at: line(12).start - 0.2, src: 'rec/phone/raid.mp4', from: 7.6, kind: 'phone' }, // window closes (curtain)
  { at: line(13).start - 0.2, src: 'rec/phone/raid.mp4', from: 12.5, kind: 'phone' }, // end block drawn, checking hits
  { at: line(15).start - 0.2, src: 'rec/phone/raid.mp4', from: 22.5, kind: 'phone' }, // VICTORY
  { at: line(16).start, src: 'rec/phone/raid.mp4', from: 1.0, kind: 'phone' }, // results: 58 hits, 1 seat
  { at: line(18).start - 0.3, src: '', from: 0, kind: 'card', card: 'end' },
]

/* ------------------------------------------------------------------ proof chips */

type Chip = { at: number; until: number; title: string; sub: string; icon: string }
const CHIPS: Chip[] = [
  { at: line(2).start + 0.6, until: line(4).start, title: 'Sponsor wall', sub: 'token + price cap + USDC prize', icon: 'flag_sponsor.webp' },
  { at: line(6).start + 0.3, until: line(8).start, title: '1 Lil Star = 1 seat', sub: 'no Star, no count', icon: 'seat_ticket.webp' },
  { at: line(9).start + 0.4, until: line(11).start, title: 'Every HIT = a real buy', sub: "limit order on Kuru's onchain book", icon: 'hit_spark.webp' },
  { at: line(10).start + 0.6, until: line(12).start, title: 'Never above the cap', sub: 'leftover cancelled + refunded, same tx', icon: 'shield.webp' },
  { at: line(13).start + 0.8, until: line(15).start, title: `End block ${Number(RAID.endBlock ?? 0).toLocaleString('en-US')}`, sub: 'drawn by Pyth Entropy after the window', icon: 'dice_block.webp' },
  { at: line(15).start + 0.4, until: line(18).start, title: `Raid #${RAID.id} broke its wall`, sub: `${RAID.countedHits} hits · ${Math.round(RAID.counted)} / ${Math.round(RAID.target)} counted · Monad testnet`, icon: 'trophy.webp' },
]

/* ------------------------------------------------------------------ pieces */

function PhoneShot({ src, from, len }: { src: string; from: number; len: number }) {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 14, stiffness: 160 } })
  const out = interpolate(fr, [len - 6, len], [0, 1], clamp)
  const h = 960
  const w = Math.round(h * (780 / 1688))
  return (
    <div className="absolute" style={{ left: 520, top: 30, width: w + 30, height: h + 30, transform: `translateY(${(1 - p) * 300 - out * 40}px) rotate(${(1 - p) * -6}deg)` }}>
      <div className="absolute inset-0 rounded-[60px] bg-[#0d0b18] shadow-[0_0_0_6px_#4a4373,0_30px_70px_rgba(0,0,0,0.55)]" />
      <div className="absolute overflow-hidden rounded-[46px]" style={{ left: 15, top: 15, width: w, height: h }}>
        <OffthreadVideo src={staticFile(src)} trimBefore={f(from)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  )
}

function DeskShot({ src, from }: { src: string; from: number }) {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 14, stiffness: 160 } })
  return (
    <div className="absolute overflow-hidden rounded-[22px] border-[6px] border-grape-800 bg-black shadow-[0_14px_0_#2d2250,0_30px_60px_rgba(0,0,0,0.5)]" style={{ left: 80, top: 110, width: 1180, height: 664, transform: `translateX(${(1 - p) * -600}px) rotate(${(1 - p) * -4}deg)` }}>
      <OffthreadVideo src={staticFile(src)} trimBefore={f(from)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

function TitleCard() {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr - 4, fps: SONG_FPS, config: { damping: 9, stiffness: 140 } })
  const crew = ['chog', 'bunny', 'fox', 'bear']
  return (
    <AbsoluteFill className="items-center justify-center">
      <Img src={staticFile('art/wordmark.svg')} className="h-[440px] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]" style={{ transform: `scale(${0.3 + 0.7 * p}) rotate(${(1 - p) * -14}deg)`, opacity: Math.min(1, p * 1.5) }} />
      <div className="mt-2 flex items-end gap-3">
        {crew.map((w, i) => (
          <Img key={w} src={staticFile(`art/crew/${w}_cheer.webp`)} className="h-[170px] w-auto" style={{ transform: `translateY(${-Math.abs(Math.sin((fr - 20 - i * 4) / 6)) * 24}px)`, opacity: interpolate(fr, [20 + i * 3, 30 + i * 3], [0, 1], clamp) }} />
        ))}
      </div>
      <div className="title-outline mt-4 text-[54px]" style={{ opacity: interpolate(fr, [60, 75], [0, 1], clamp) }}>
        the demo, as a song
      </div>
    </AbsoluteFill>
  )
}

function EndCard() {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 10, stiffness: 160 } })
  return (
    <AbsoluteFill className="items-center justify-center">
      <Img src={staticFile('art/wordmark-h.svg')} className="h-[230px] w-auto" style={{ transform: `scale(${p})` }} />
      <div className="mt-6 rounded-full border-[5px] border-grape-800 bg-ember-400 px-10 py-3 font-display text-[64px] text-white shadow-[0_8px_0_#2d2250]" style={{ transform: `scale(${spring({ frame: fr - 8, fps: SONG_FPS, config: { damping: 9, stiffness: 220 } })})` }}>
        starraid.xyz
      </div>
      <div className="mt-6 flex items-center gap-6 text-[30px] font-bold text-cream-100" style={{ opacity: interpolate(fr, [14, 24], [0, 1], clamp) }}>
        <span>Monad testnet</span>
        <span>·</span>
        <span>Kuru</span>
        <span>·</span>
        <span>Pyth Entropy</span>
        <span>·</span>
        <span>Lil Stars seats</span>
      </div>
      <div className="mt-3 text-[24px] text-grape-300" style={{ opacity: interpolate(fr, [20, 30], [0, 1], clamp) }}>
        github.com/zexoverz/star-raid · song made with ElevenLabs Music
      </div>
    </AbsoluteFill>
  )
}

function ProofChip({ c }: { c: Chip }) {
  const fr = useCurrentFrame()
  const p = spring({ frame: fr, fps: SONG_FPS, config: { damping: 11, stiffness: 220 } })
  const len = f(c.until - c.at)
  const out = interpolate(fr, [len - 8, len], [0, 1], { ...clamp, easing: (x) => x * x })
  return (
    <div className="flex items-center gap-4 rounded-[24px] border-[5px] border-grape-800 bg-cream-100 px-6 py-4 text-grape-900 shadow-[0_8px_0_#2d2250]" style={{ transform: `translateX(${(1 - p) * 500 + out * 700}px) rotate(-1.5deg)`, opacity: Math.min(1, p * 1.5) * (1 - out * 0.5) }}>
      <Img src={staticFile(`art/${c.icon}`)} className="h-[72px] w-[72px] object-contain" />
      <div>
        <div className="font-display text-[40px] leading-none">{c.title}</div>
        <div className="mt-1 text-[24px] font-bold text-grape-700">{c.sub}</div>
      </div>
    </div>
  )
}

/** Karaoke: the current line, each word lighting up as it is sung (word times from STT of the song). */
function Karaoke() {
  const fr = useCurrentFrame()
  const t = fr / SONG_FPS
  const ln = L.find((l) => t >= l.start - 0.15 && t <= l.end + 0.35)
  if (!ln) return null
  const words = ln.t.split(' ')
  const sung = W.filter((w) => w.s >= ln.start - 0.05 && w.e <= ln.end + 0.05)
  const startF = f(ln.start - 0.15)
  const pop = spring({ frame: fr - startF, fps: SONG_FPS, config: { damping: 11, stiffness: 240 } })
  return (
    <div className="absolute inset-x-0 bottom-[46px] flex justify-center px-24">
      <div className="flex flex-wrap justify-center gap-x-4 rounded-[28px] bg-grape-950/70 px-8 py-3" style={{ transform: `scale(${0.85 + 0.15 * pop})` }}>
        {words.map((w, i) => {
          const at = sung[i]?.s ?? ln.start + ((ln.end - ln.start) * i) / words.length
          const on = t >= at - 0.04
          const hot = /^(hit|wall|kuru|monad|pyth|star|seat|prize|cap|block|raid)/i.test(w)
          return (
            <span key={i} className="title-outline-sm text-[58px] leading-tight" style={{ color: on ? (hot ? '#ffb84d' : '#ffffff') : 'rgba(255,255,255,0.32)', transform: `translateY(${on ? 0 : 6}px)`, display: 'inline-block' }}>
              {w}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** A beat-synced pulse on the background (128 bpm), so the frame breathes with the song. */
function Pulse() {
  const fr = useCurrentFrame()
  const beat = (fr / SONG_FPS) * (128 / 60)
  const k = Math.pow(1 - (beat % 1), 3)
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 30% 40%, rgba(255,184,77,${0.1 + 0.12 * k}), transparent 60%)` }} />
}

export function SongDemo() {
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 20%, #4a4373, #15122a 70%)' }}>
      <Pulse />
      <Twinkles count={16} seed={11} />
      {SHOTS.map((s, i) => {
        const next = SHOTS[i + 1]?.at ?? 85
        const from = f(s.at)
        const len = f(next) - from
        return (
          <Sequence key={i} from={from} durationInFrames={len} layout="none">
            <AbsoluteFill>{s.kind === 'phone' ? <PhoneShot src={s.src} from={s.from} len={len} /> : s.kind === 'desk' ? <DeskShot src={s.src} from={s.from} /> : s.card === 'title' ? <TitleCard /> : <EndCard />}</AbsoluteFill>
            <Sequence from={0} durationInFrames={20} layout="none">
              <Html5Audio src={staticFile('audio/kit/whoosh.mp3')} volume={0.12} />
            </Sequence>
          </Sequence>
        )
      })}
      <div className="absolute right-[60px] top-[140px] flex w-[640px] flex-col items-end gap-5">
        {CHIPS.map((c, i) => (
          <Sequence key={i} from={f(c.at)} durationInFrames={f(c.until - c.at)} layout="none">
            <ProofChip c={c} />
          </Sequence>
        ))}
      </div>
      <Karaoke />
      <Html5Audio src={staticFile('audio/song/star-raid-song.mp3')} volume={(fr) => interpolate(fr, [SONG_TOTAL - 45, SONG_TOTAL], [1, 0], clamp)} />
    </AbsoluteFill>
  )
}
