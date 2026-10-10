/**
 * Demo scene, right half: one big animated illustration per step instead of a static list, so
 * every line he says has something happening on screen. Art is the app's own (Lil Stars crew poses
 * are used as-is, never altered). No invented numbers: nothing here shows a price, amount or count.
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { pose } from '../assets'
import { clamp } from '../ui'
import { Sfx, type SfxKind } from './parts'

const art = (p: string) => staticFile(`art/${p}`)
const doodle = (p: string) => staticFile(`doodle/${p}.png`)
const card = 'rounded-[28px] border-[5px] border-grape-800 bg-cream-100 text-grape-900 shadow-[0_9px_0_#2d2250]'

/** Pure spring, safe inside maps and conditionals. `f` is the scene frame from useCurrentFrame. */
const pop = (f: number, at: number, damping = 11, stiffness = 200) => spring({ frame: f - at, fps: 30, config: { damping, stiffness } })

function Title({ n, k, d, at }: { n: number; k: string; d: string; at: number }) {
  const F = useCurrentFrame()
  const p = pop(F, at)
  return (
    <div className="flex items-center gap-5" style={{ transform: `translateX(${(1 - p) * 120}px) rotate(-2deg)`, opacity: Math.min(1, p * 1.6) }}>
      <span className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full border-[5px] border-grape-800 bg-ember-300 font-display text-[48px] text-grape-900 shadow-[0_6px_0_#2d2250]">{n}</span>
      <div>
        <div className="title-outline text-[78px] leading-none">{k}</div>
        <div className="mt-1 text-[32px] font-bold text-cream-100/90">{d}</div>
      </div>
    </div>
  )
}

/* 1. Lobby: the next raid is up, live. */
function Lobby({ at }: { at: number }) {
  const F = useCurrentFrame()
  const frame = F - at
  const p = pop(F, at + 6)
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4)
  return (
    <div className="relative h-full w-full">
      <div className={`${card} absolute left-[60px] top-[40px] flex w-[760px] items-center gap-8 px-8 py-6`} style={{ transform: `scale(${0.6 + 0.4 * p}) rotate(-2deg)`, opacity: Math.min(1, p * 1.5) }}>
        <Img src={art('wall_boss.webp')} className="h-[220px] w-[220px]" style={{ transform: `translateY(${Math.sin(frame / 8) * 6}px)` }} />
        <div>
          <div className="flex items-center gap-3 text-[30px] font-extrabold uppercase tracking-widest text-candy-600">
            <span className="inline-block h-5 w-5 rounded-full bg-candy-500" style={{ opacity: 0.4 + 0.6 * pulse, transform: `scale(${0.8 + 0.4 * pulse})` }} />
            live
          </div>
          <div className="font-display text-[64px] leading-none">Next raid</div>
          <div className="mt-2 text-[28px] font-semibold text-grape-700">on your phone, right now</div>
        </div>
      </div>
      <Img src={art('hourglass.webp')} className="absolute left-[640px] top-[330px] h-[200px] w-[200px]" style={{ transform: `rotate(${interpolate(frame % 50, [0, 12, 50], [0, 180, 180], clamp)}deg)`, opacity: Math.min(1, pop(F, at + 14) * 1.5) }} />
      {(['fox', 'bunny', 'chog'] as const).map((w, i) => {
        const q = pop(F, at + 18 + i * 5, 9, 220)
        return <Img key={w} src={pose(w, 'cheer')} className="absolute h-[250px] w-auto" style={{ left: 70 + i * 180, top: 320, transform: `translateY(${(1 - q) * 200 - Math.abs(Math.sin((frame - i * 5) / 6)) * 18}px)`, opacity: Math.min(1, q * 2) }} />
      })}
    </div>
  )
}

/* 2. Sponsor: wall, cap price, USDC prize land one after another. */
function Sponsor({ at, len }: { at: number; len: number }) {
  const F = useCurrentFrame()
  const frame = F - at
  const items = [
    { t: 'The wall', d: 'their token, one price', img: art('wall_boss.webp'), o: 0.08 },
    { t: 'Price cap', d: 'nobody buys above it', img: doodle('router'), o: 0.35 },
    { t: 'USDC prize', d: 'only for seats', img: art('chest_closed.webp'), o: 0.6 },
  ]
  return (
    <div className="relative h-full w-full">
      <Img src={art('flag_sponsor.webp')} className="absolute left-[780px] top-[0px] h-[190px] w-auto" style={{ transform: `rotate(${Math.sin(frame / 7) * 6}deg)`, transformOrigin: 'bottom left', opacity: Math.min(1, pop(F, at) * 1.5) }} />
      {items.map((it, i) => {
        const a = at + Math.round(len * it.o)
        const q = pop(F, a, 10, 230)
        return (
          <div key={it.t} className={`${card} absolute flex w-[700px] items-center gap-6 px-7 py-4`} style={{ left: 60 + i * 40, top: 40 + i * 175, transform: `translateX(${(1 - q) * 500}px) rotate(${i % 2 ? 1.5 : -1.5}deg)`, opacity: Math.min(1, q * 1.5) }}>
            <Img src={it.img} className="h-[120px] w-[120px] object-contain" style={{ mixBlendMode: it.img.includes('doodle') ? 'multiply' : undefined }} />
            <div>
              <div className="font-display text-[54px] leading-none">{it.t}</div>
              <div className="mt-1 text-[28px] font-semibold text-grape-700">{it.d}</div>
            </div>
            {frame > a - at + 4 && <span className="ml-auto font-display text-[60px] text-mint-600" style={{ transform: `scale(${pop(F, a + 6, 8, 300)})` }}>✓</span>}
          </div>
        )
      })}
      {/* coins drop into the prize */}
      {Array.from({ length: 6 }, (_, i) => {
        const s = Math.round(len * 0.66) + i * 4
        const y = interpolate(frame, [s, s + 14], [-120, 420], clamp)
        if (frame < s || frame > s + 16) return null
        return <Img key={i} src={art('coin.webp')} className="absolute h-[70px] w-[70px]" style={{ left: 760 + (i % 3) * 30, top: y, transform: `rotate(${frame * 12}deg)` }} />
      })}
    </div>
  )
}

/* 3. One Star, one seat: a Lil Star gets a seat, the bot bounces off. */
function Seat({ at, len }: { at: number; len: number }) {
  const F = useCurrentFrame()
  const frame = F - at
  const star = pop(F, at + 4, 12, 160)
  const botAt = Math.round(len * 0.55)
  const bounce = interpolate(frame, [botAt, botAt + 10, botAt + 22], [520, 360, 760], clamp)
  return (
    <div className="relative h-full w-full">
      <div className={`${card} absolute left-[300px] top-[90px] grid h-[330px] w-[300px] place-items-center`} style={{ transform: 'rotate(2deg)' }}>
        <Img src={art('seat_ticket.webp')} className="h-[220px] w-[220px]" />
        <div className="absolute -bottom-6 rounded-full border-[4px] border-grape-800 bg-ember-300 px-5 py-1 font-display text-[30px]">1 seat</div>
      </div>
      <Img src={pose('fox', 'cheer')} className="absolute h-[330px] w-auto" style={{ left: interpolate(star, [0, 1], [-260, 40]), top: 120, transform: `translateY(${-Math.abs(Math.sin(frame / 6)) * 12}px)` }} />
      {frame > 22 && <div className="absolute left-[150px] top-[60px] font-display text-[52px] text-mint-300" style={{ transform: `scale(${pop(F, at + 22, 8, 300)}) rotate(-8deg)` }}>✓ counts</div>}
      {frame >= botAt && (
        <>
          <Img src={art('bot.webp')} className="absolute h-[220px] w-[220px]" style={{ left: bounce + 140, top: 200, transform: `rotate(${interpolate(frame, [botAt + 10, botAt + 22], [0, 40], clamp)}deg)` }} />
          <div className="absolute left-[640px] top-[150px] font-display text-[110px] text-candy-500" style={{ transform: `scale(${pop(F, at + botAt + 10, 7, 320)}) rotate(10deg)` }}>✕</div>
          <div className="absolute left-[640px] top-[450px] w-[520px] text-[34px] font-bold leading-snug text-cream-100" style={{ opacity: interpolate(frame, [botAt + 12, botAt + 20], [0, 1], clamp) }}>
            no Lil Star? the buy works, but counts for nothing
          </div>
        </>
      )}
    </div>
  )
}

/* 4. Set up once: the wallet popups fly away, then it is one tap. */
function OneTap({ at, len }: { at: number; len: number }) {
  const F = useCurrentFrame()
  const frame = F - at
  const away = Math.round(len * 0.4)
  return (
    <div className="relative h-full w-full">
      {[0, 1, 2].map((i) => {
        const inn = pop(F, at + i * 5, 12, 200)
        const out = interpolate(frame, [away + i * 3, away + i * 3 + 12], [0, 1], { ...clamp, easing: (t) => t * t })
        return (
          <div key={i} className={`${card} absolute w-[460px] px-6 py-4`} style={{ left: 120 + i * 60, top: 60 + i * 70, transform: `translate(${out * (900 + i * 100)}px, ${-out * 300}px) rotate(${-4 + i * 4 + out * 40}deg) scale(${inn})`, opacity: 1 - out * 0.6 }}>
            <div className="text-[24px] font-extrabold uppercase tracking-widest text-grape-600">wallet</div>
            <div className="font-display text-[40px] leading-tight">Confirm transaction?</div>
            <div className="mt-3 flex gap-3">
              <span className="rounded-full bg-grape-200 px-5 py-1 text-[24px] font-bold">Reject</span>
              <span className="rounded-full bg-ember-300 px-5 py-1 text-[24px] font-bold">Confirm</span>
            </div>
          </div>
        )
      })}
      {frame >= away + 8 && (
        <div className="absolute left-[180px] top-[330px] flex items-center gap-8" style={{ transform: `scale(${pop(F, at + away + 8, 9, 220)})` }}>
          <div className="relative grid h-[280px] w-[280px] place-items-center rounded-full border-[6px] border-grape-800 bg-ember-500 shadow-[0_10px_0_#2d2250]" style={{ transform: `scale(${1 - 0.08 * Math.max(0, Math.sin(frame / 3))})` }}>
            <span className="title-outline text-[90px]">TAP</span>
            <span className="absolute inset-0 rounded-full border-[6px] border-ember-300" style={{ transform: `scale(${1 + ((frame % 18) / 18) * 0.6})`, opacity: 1 - (frame % 18) / 18 }} />
          </div>
          <div>
            <div className="title-outline text-[72px] leading-none">one tap</div>
            <div className="title-outline-sm mt-2 text-[44px] text-ember-300">no popups</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* 5. HIT: the crew attacks, the wall shakes, sparks fly. */
function Hit({ at }: { at: number }) {
  const F = useCurrentFrame()
  const frame = F - at
  const shake = Math.sin(frame * 2.3) * 10 * (frame % 9 < 4 ? 1 : 0.3)
  return (
    <div className="relative h-full w-full">
      <Img src={art(frame > 70 ? 'wall_boss_hurt.webp' : 'wall_boss.webp')} className="absolute left-[520px] top-[60px] h-[440px] w-[440px]" style={{ transform: `translateX(${shake}px) rotate(${shake * 0.3}deg)` }} />
      {Array.from({ length: 10 }, (_, i) => {
        const t0 = (i * 9) % 60
        const f = (frame - t0 + 600) % 60
        if (f > 14 || frame < t0) return null
        return <Img key={i} src={art('hit_spark.webp')} className="absolute h-[150px] w-[150px]" style={{ left: 540 + ((i * 97) % 300), top: 90 + ((i * 61) % 300), transform: `scale(${interpolate(f, [0, 4, 14], [0.2, 1.3, 0.6], clamp)}) rotate(${i * 40}deg)`, opacity: interpolate(f, [8, 14], [1, 0], clamp) }} />
      })}
      {(['bear', 'fox', 'chog', 'bunny'] as const).map((w, i) => {
        const q = pop(F, at + i * 4, 10, 220)
        const lunge = Math.max(0, Math.sin((frame - i * 6) / 4)) * 40
        return <Img key={w} src={pose(w, 'attack')} className="absolute h-[230px] w-auto" style={{ left: 20 + (i % 2) * 190, top: 60 + Math.floor(i / 2) * 250, transform: `translateX(${(1 - q) * -400 + lunge}px)` }} />
      })}
      <div className="absolute left-[560px] top-[420px] title-outline text-[120px]" style={{ transform: `scale(${1 + 0.12 * Math.max(0, Math.sin(frame / 2.5))}) rotate(-6deg)`, color: '#ffb84d' }}>
        HIT!
      </div>
    </div>
  )
}

/* 6. The draw: dice roll, the end block lands, the wall breaks. */
function Draw({ at, len }: { at: number; len: number }) {
  const F = useCurrentFrame()
  const frame = F - at
  const land = Math.round(len * 0.4)
  const ko = Math.round(len * 0.7)
  return (
    <div className="relative h-full w-full">
      <Img src={doodle('pyth')} className="absolute left-[60px] top-[40px] h-[300px] w-[300px] rounded-[40px] bg-white" style={{ transform: frame < land ? `rotate(${frame * 25}deg) translateY(${Math.abs(Math.sin(frame / 2)) * -30}px)` : `rotate(-6deg) scale(${pop(F, at + land, 8, 260)})` }} />
      {frame >= land && (
        <div className={`${card} absolute left-[400px] top-[100px] px-7 py-4`} style={{ transform: `scale(${pop(F, at + land, 9, 260)}) rotate(3deg)` }}>
          <div className="text-[26px] font-extrabold uppercase tracking-widest text-grape-600">Pyth Entropy</div>
          <div className="font-display text-[56px] leading-none">end block drawn</div>
        </div>
      )}
      {frame >= land + 12 && (
        <div className="absolute left-[400px] top-[250px] flex flex-col gap-2">
          {['hits before it: counted ✓', 'hits after it: not counted ✕'].map((t, i) => (
            <div key={t} className={`title-outline-sm text-[44px] ${i ? 'text-candy-300' : 'text-mint-300'}`} style={{ transform: `translateX(${(1 - pop(F, at + land + 12 + i * 8)) * 300}px)` }}>
              {t}
            </div>
          ))}
        </div>
      )}
      {frame >= ko && (
        <>
          <Img src={art('victory_burst.webp')} className="absolute left-[880px] top-[40px] h-[340px] w-[340px]" style={{ transform: `scale(${pop(F, at + ko, 7, 200)}) rotate(${frame}deg)` }} />
          <Img src={art('wall_boss_ko.webp')} className="absolute left-[920px] top-[70px] h-[270px] w-[270px]" style={{ transform: `scale(${pop(F, at + ko, 8, 240)})` }} />
          <div className="absolute left-[60px] top-[440px] title-outline text-[100px]" style={{ color: '#a3e3c1', transform: `scale(${pop(F, at + ko + 4, 7, 300)}) rotate(-4deg)` }}>
            WALL BROKEN
          </div>
        </>
      )}
    </div>
  )
}

const STEPS = [
  { k: 'The lobby', d: 'next raid, live', C: Lobby, sfx: 'click' },
  { k: 'Sponsor', d: 'wall · cap · prize', C: Sponsor, sfx: 'coin' },
  { k: 'One Star, one seat', d: 'the bot defence', C: Seat, sfx: 'join' },
  { k: 'Set up once', d: 'then one tap', C: OneTap, sfx: 'click' },
  { k: 'HIT!', d: 'every hit is a buy', C: Hit, sfx: 'hit' },
  { k: 'The draw', d: 'every hit checked', C: Draw, sfx: 'reveal' },
] as const

/** The right half of the demo scene. `cues` are the frames where each spoken line starts. */
export function DemoPanels({ cues, total }: { cues: number[]; total: number }) {
  const frame = useCurrentFrame()
  const i = Math.max(0, cues.filter((c) => frame >= c).length - 1)
  return (
    <AbsoluteFill>
      {/* step tracker */}
      <div className="absolute left-[700px] top-[44px] flex gap-3">
        {STEPS.map((s, n) => (
          <div key={s.k} className="h-[14px] w-[120px] overflow-hidden rounded-full border-[3px] border-grape-800 bg-grape-900">
            <div className="h-full bg-ember-400" style={{ width: `${n < i ? 100 : n > i ? 0 : interpolate(frame, [cues[n], cues[n + 1] ?? total], [0, 100], clamp)}%` }} />
          </div>
        ))}
      </div>
      {STEPS.map((s, n) => {
        const at = cues[n] ?? 0
        const end = cues[n + 1] ?? total
        if (frame < at - 2 || frame >= end) return null
        const C = s.C
        return (
          <AbsoluteFill key={s.k}>
            <div className="absolute left-[700px] top-[96px]">
              <Title n={n + 1} k={s.k} d={s.d} at={at} />
            </div>
            <div className="absolute left-[660px] top-[290px] h-[640px] w-[1220px]">
              <C at={at} len={end - at} />
            </div>
          </AbsoluteFill>
        )
      })}
      <DemoSounds cues={cues} total={total} />
    </AbsoluteFill>
  )
}

/** Step sound, title slide-in, each element's entrance, and a slide-out as the step leaves. */
function DemoSounds({ cues, total }: { cues: number[]; total: number }) {
  const s: { at: number; kind: SfxKind }[] = []
  const add = (at: number, kind: SfxKind) => s.push({ at, kind })
  STEPS.forEach((st, n) => {
    const at = cues[n] ?? 0
    const end = cues[n + 1] ?? total
    const len = end - at
    add(at, st.sfx as SfxKind)
    add(at + 2, 'slide-in')
    if (n === 0) {
      add(at + 6, 'card')
      add(at + 14, 'boing')
      ;[18, 23, 28].forEach((d) => add(at + d, 'boing'))
    } else if (n === 1) {
      add(at, 'slide-in')
      ;[0.08, 0.35, 0.6].forEach((o) => add(at + Math.round(len * o), 'slide-in'))
      add(at + Math.round(len * 0.66), 'coin')
    } else if (n === 2) {
      add(at + 4, 'slide-in')
      add(at + 22, 'boing')
      add(at + Math.round(len * 0.55) + 10, 'hit')
    } else if (n === 3) {
      ;[0, 5, 10].forEach((d) => add(at + d, 'card'))
      ;[0, 3, 6].forEach((d) => add(at + Math.round(len * 0.4) + d, 'slide-out'))
      add(at + Math.round(len * 0.4) + 8, 'boing')
    } else if (n === 5) {
      add(at + Math.round(len * 0.4), 'stamp')
      ;[12, 20].forEach((d) => add(at + Math.round(len * 0.4) + d, 'slide-in'))
      add(at + Math.round(len * 0.7), 'victory')
    }
    if (n < STEPS.length - 1) add(end - 4, 'slide-out')
  })
  return (
    <>
      {s.map((x, i) => (
        <Sfx key={i} at={x.at} kind={x.kind} volume={x.kind === 'victory' ? 0.3 : undefined} />
      ))}
    </>
  )
}
