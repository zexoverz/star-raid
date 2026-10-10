/**
 * "Who are the Lil Stars?" One beat per spoken line. Only official Lil Stars material, unaltered:
 * the animated crew art and logos from lilstars.xyz (public/art/lilstars) and screenshots of the
 * site (public/lilstars/site). Every claim is from lilstars.xyz (About + Characters pages).
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { clamp } from '../ui'
import { Sfx, type SfxKind } from './parts'

const ls = (p: string) => staticFile(`art/lilstars/${p}`)
const site = (p: string) => staticFile(`lilstars/site/${p}`)
const pop = (f: number, at: number, damping = 11, stiffness = 200) => spring({ frame: f - at, fps: 30, config: { damping, stiffness } })
const card = 'rounded-[28px] border-[5px] border-grape-800 bg-cream-100 text-grape-900 shadow-[0_9px_0_#2d2250]'

const CREW = [
  { name: 'Chogstar', art: 'chog.webp', color: '#A3E3C1', line: 'a CC0 Monanimal, born from community energy on Monad' },
  { name: 'Bunnystar', art: 'bunny.webp', color: '#F7B2D9', line: 'sassy by default, main character energy' },
  { name: 'Foxstar', art: 'fox.webp', color: '#F7C873', line: 'always cheering people on, always vibing' },
  { name: 'Bearstar', art: 'bear.webp', color: '#B6D6F7', line: 'the funny trickster, chaos with charm' },
]

/** A browser window with a screenshot that slowly scrolls/zooms, so the site feels live. */
function Browser({ src, url, at, x, y, w, tilt = 0 }: { src: string; url: string; at: number; x: number; y: number; w: number; tilt?: number }) {
  const F = useCurrentFrame()
  const p = pop(F, at, 13, 160)
  const h = Math.round((w * 9) / 16)
  const zoom = interpolate(F - at, [0, 150], [1, 1.08], clamp)
  return (
    <div className="absolute overflow-hidden rounded-[22px] border-[5px] border-grape-800 bg-white shadow-[0_14px_0_#2d2250,0_30px_60px_rgba(0,0,0,0.35)]" style={{ left: x, top: y, width: w, transform: `translateY(${(1 - p) * 300}px) rotate(${tilt}deg)`, opacity: Math.min(1, p * 1.5) }}>
      <div className="flex items-center gap-3 border-b-[4px] border-grape-800 bg-cream-100 px-4 py-2">
        <span className="h-4 w-4 rounded-full bg-candy-400" />
        <span className="h-4 w-4 rounded-full bg-ember-300" />
        <span className="h-4 w-4 rounded-full bg-mint" />
        <span className="ml-3 rounded-full bg-white px-5 py-1 text-[24px] font-bold text-grape-700">{url}</span>
      </div>
      <div className="overflow-hidden" style={{ height: h }}>
        <Img src={src} className="h-full w-full object-cover" style={{ transform: `scale(${zoom})`, transformOrigin: '50% 30%' }} />
      </div>
    </div>
  )
}

export function LilStarsPanel({ cues, total }: { cues: number[]; total: number }) {
  const F = useCurrentFrame()
  const beat = Math.max(0, cues.filter((c) => F >= c).length - 1)
  const c = (i: number) => cues[i] ?? total
  const vis = (i: number, j = i + 1) => F >= c(i) - 2 && F < c(j)
  return (
    <AbsoluteFill>
      {/* 0. "So who are the Lil Stars?" logo slam */}
      {vis(0) && (
        <AbsoluteFill className="items-center justify-center">
          <Img src={ls('graffiti_logo.webp')} className="h-[520px] w-auto drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]" style={{ transform: `scale(${0.3 + 0.7 * pop(F, c(0), 8, 180)}) rotate(${(1 - pop(F, c(0), 8, 180)) * -20}deg)` }} />
          <div className="title-outline mt-2 text-[86px]" style={{ transform: `scale(${pop(F, c(0) + 8, 9, 260)})` }}>
            who are they?
          </div>
        </AbsoluteFill>
      )}
      {/* 1. what it is: a real NFT collection. Cards fan out of the deck, the 6,000-piece wall scrolls behind */}
      {vis(1) && <Collection at={c(1)} end={c(2)} />}
      {/* 2. the crew: four animated cards land one by one, each with its official one-line bio */}
      {vis(2) && (
        <div className="absolute left-[70px] top-[70px] flex gap-6">
          {CREW.map((m, i) => {
            const at = c(2) + Math.round(((c(3) - c(2)) / 5) * i)
            const p = pop(F, at, 10, 210)
            return (
              <div key={m.name} className={`${card} flex w-[330px] flex-col items-center px-4 pb-5 pt-3`} style={{ background: m.color, transform: `translateY(${(1 - p) * 500}px) rotate(${[-3, 2, -2, 3][i]}deg)`, opacity: Math.min(1, p * 1.5) }}>
                <div className="grid h-[360px] w-full place-items-end justify-center">
                  <Img src={ls(m.art)} className="max-h-[350px] w-auto" />
                </div>
                <div className="title-outline mt-1 text-[52px] leading-none">{m.name}</div>
                <div className="mt-2 text-center text-[23px] font-bold leading-snug text-grape-900">{m.line}</div>
              </div>
            )
          })}
        </div>
      )}
      {/* 3. growing off-chain: the real merch unboxing and IRL event, from their News page */}
      {vis(3) && <Irl at={c(3)} />}
      {/* 4. people noticed: press quote cards (short, credited) */}
      {vis(4) && <Press at={c(4)} end={c(5)} />}
      {/* 5. motto */}
      {vis(5) && (
        <AbsoluteFill className="items-center justify-center pr-[460px]">
          <div className="flex items-end gap-2">
            {CREW.map((m, i) => (
              <Img key={m.name} src={ls(m.art)} className="h-[300px] w-auto" style={{ transform: `translateY(${(1 - pop(F, c(5) + i * 4, 9, 220)) * 400 - Math.abs(Math.sin((F - i * 5) / 6)) * 16}px)` }} />
            ))}
          </div>
          <div className="title-outline mt-6 text-center text-[88px] leading-[1.05]" style={{ color: '#ffd27a', transform: `scale(${pop(F, c(5) + 14, 8, 260)}) rotate(-3deg)` }}>
            everyone can be a star
          </div>
        </AbsoluteFill>
      )}
      {/* 6. in Star Raid, your Lil Star is your seat */}
      {vis(6) && (
        <AbsoluteFill className="items-center justify-center pr-[300px]">
          <div className="flex items-center gap-10">
            <div className={`${card} p-5`} style={{ transform: `rotate(-4deg) scale(${pop(F, c(6), 10, 220)})` }}>
              <Img src={staticFile('lilstars/nft/c8.png')} className="h-[320px] w-[320px] rounded-[16px]" />
              <div className="mt-2 text-center font-display text-[36px]">your Lil Star</div>
            </div>
            <div className="title-outline text-[130px]" style={{ transform: `scale(${pop(F, c(6) + 10, 8, 300)})` }}>
              =
            </div>
            <div className={`${card} p-5`} style={{ transform: `rotate(4deg) scale(${pop(F, c(6) + 18, 10, 220)})` }}>
              <Img src={staticFile('art/seat_ticket.webp')} className="h-[320px] w-[320px]" />
              <div className="mt-2 text-center font-display text-[36px]">one raid seat</div>
            </div>
          </div>
        </AbsoluteFill>
      )}
      {/* 7. where to find them */}
      {F >= c(7) - 2 && <FindThem at={c(7)} />}
      {/* beat dots */}
      <div className="absolute left-1/2 top-[22px] flex -translate-x-1/2 gap-3">
        {cues.map((_, i) => (
          <span key={i} className="h-[12px] w-[44px] rounded-full border-[3px] border-grape-800" style={{ background: i <= beat ? '#ffb84d' : '#2d2250' }} />
        ))}
      </div>
      <PanelSounds c={c} n={cues.length} />
    </AbsoluteFill>
  )
}

/**
 * Every element that enters gets a sound on the frame it starts moving, and every beat gets a
 * slide-out on the frame its visuals leave. Offsets mirror the `pop(F, ...)` delays above.
 */
function PanelSounds({ c, n }: { c: (i: number) => number; n: number }) {
  const s: { at: number; kind: SfxKind }[] = []
  const add = (at: number, kind: SfxKind) => s.push({ at, kind })
  // 0 logo slam + question
  add(c(0), 'stamp')
  add(c(0) + 8, 'boing')
  // 1 collection: card fan, holo shine, three tags
  SHOW.forEach((_, i) => add(c(1) + 4 + i * 4, 'card'))
  add(c(1) + 34, 'sparkle')
  const len1 = c(2) - c(1)
  ;[10, Math.round(len1 * 0.35), Math.round(len1 * 0.6)].forEach((d) => add(c(1) + d, 'slide-in'))
  // 2 crew cards
  CREW.forEach((_, i) => add(c(2) + Math.round(((c(3) - c(2)) / 5) * i), 'card'))
  // 3 IRL photos + caption
  ;[2, 16, 30].forEach((d) => add(c(3) + d, 'photo'))
  add(c(3) + 40, 'stamp')
  // 4 press title + quotes
  add(c(4), 'boing')
  const step = Math.max(14, Math.round((c(5) - c(4)) / (PRESS.length + 1)))
  PRESS.forEach((_, i) => add(c(4) + 8 + i * step, 'slide-in'))
  // 5 motto: crew hops in, then the line
  add(c(5), 'boing')
  add(c(5) + 14, 'sparkle')
  // 6 your Lil Star = your seat
  add(c(6), 'card')
  add(c(6) + 10, 'stamp')
  add(c(6) + 18, 'card')
  // 7 find them: browser slides up, two link cards
  add(c(7), 'slide-in')
  add(c(7) + 8, 'boing')
  add(c(7) + 16, 'boing')
  // slide-out at the end of every beat but the last
  for (let i = 0; i < n - 1; i++) add(c(i + 1) - 4, 'slide-out')
  return (
    <>
      {s.map((x, i) => (
        <Sfx key={i} at={x.at} kind={x.kind} />
      ))}
    </>
  )
}

/** Link cards: lilstars.xyz and X @lilstarrrs, with the official logo. Reused on the end card. */
export function LilStarsLinks({ at, compact = false }: { at: number; compact?: boolean }) {
  const F = useCurrentFrame()
  const rows = [
    { k: 'site', v: 'lilstars.xyz', icon: <Img src={ls('logo.webp')} className={compact ? 'h-[44px] w-[44px]' : 'h-[84px] w-[84px]'} /> },
    {
      k: 'X',
      v: '@lilstarrrs',
      icon: (
        <span className={`grid place-items-center rounded-[14px] bg-black font-black text-white ${compact ? 'h-[44px] w-[44px] text-[28px]' : 'h-[84px] w-[84px] text-[54px]'}`}>
          𝕏
        </span>
      ),
    },
  ]
  return (
    <div className={`flex ${compact ? 'gap-4' : 'flex-col gap-6'}`}>
      {rows.map((r, i) => {
        const p = pop(F, at + i * 8, 9, 230)
        return (
          <div key={r.k} className={`${card} flex items-center ${compact ? 'gap-3 px-4 py-2' : 'gap-6 px-8 py-5'}`} style={{ transform: `scale(${p}) rotate(${i % 2 ? 2 : -2}deg)` }}>
            {r.icon}
            <span className={`font-display ${compact ? 'text-[34px]' : 'text-[66px]'} leading-none`}>{r.v}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- beat 1: the collection */

const SHOW = ['fox-mythical', 'bear-netrunner', 'bunny-novaku', 'fox-cryptic', 'bunny-comedian', 'bear-terra', 'fox-aura']

/** An NFT card: art, name, and a holo sheen sweeping across. */
function NftCard({ src, name, x, y, r, s, at }: { src: string; name: string; x: number; y: number; r: number; s: number; at: number }) {
  const F = useCurrentFrame()
  const p = pop(F, at, 12, 170)
  const sheen = ((F - at) * 9) % 900
  return (
    <div className="absolute" style={{ left: x, top: y, transform: `translate(${(1 - p) * 0}px, ${(1 - p) * 420}px) rotate(${r * p}deg) scale(${s * (0.6 + 0.4 * p)})`, opacity: Math.min(1, p * 1.6), transformOrigin: '50% 100%' }}>
      <div className="relative w-[300px] overflow-hidden rounded-[22px] border-[5px] border-grape-800 bg-cream-100 shadow-[0_10px_0_#2d2250,0_22px_40px_rgba(0,0,0,0.4)]">
        <Img src={src} className="block h-[300px] w-[300px] object-cover" />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-display text-[26px] text-grape-900">{name}</span>
          <Img src={staticFile('logos/monad.png')} className="h-[30px] w-[30px]" />
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(115deg, transparent ${sheen - 140}px, rgba(255,255,255,0.55) ${sheen - 60}px, transparent ${sheen}px)` }} />
      </div>
    </div>
  )
}

function Collection({ at, end }: { at: number; end: number }) {
  const F = useCurrentFrame()
  // the collection wall drifts behind, 24 real pieces, two rows scrolling opposite ways
  const drift = (F - at) * 1.4
  const len = end - at
  const tags = [
    { t: '6,000-piece PFPs', at: at + 10 },
    { t: 'born on Monad', at: at + Math.round(len * 0.35), logo: true },
    { t: 'formerly Chogstar', at: at + Math.round(len * 0.6) },
  ]
  return (
    <AbsoluteFill>
      <div className="absolute inset-x-0 top-[40px] opacity-30">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-4" style={{ transform: `translateX(${row ? -400 + drift : -drift}px)`, marginTop: row ? 16 : 0 }}>
            {Array.from({ length: 16 }, (_, i) => (
              <Img key={i} src={staticFile(`lilstars/nft/c${((i + row * 8) % 24) + 1}.png`)} className="h-[200px] w-[200px] rounded-[14px]" />
            ))}
          </div>
        ))}
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(21,18,42,0.2), rgba(21,18,42,0.85) 55%)' }} />
      {/* the fan of showcase cards */}
      {SHOW.map((n, i) => {
        const k = i - (SHOW.length - 1) / 2
        return <NftCard key={n} src={staticFile(`lilstars/nft/${n}.png`)} name={`Lilstars · ${n.split('-')[1]}`} x={960 + k * 112} y={310 + Math.abs(k) * 22} r={k * 6} s={0.92 - Math.abs(k) * 0.04} at={at + 4 + i * 4} />
      })}
      <div className="absolute left-[70px] top-[330px] flex w-[520px] flex-col gap-5">
        {tags.map((x, i) => {
          const p = pop(F, x.at, 10, 230)
          return (
            <div key={x.t} className={`${card} flex items-center gap-4 px-6 py-4`} style={{ transform: `translateX(${(1 - p) * -500}px) rotate(${i % 2 ? 1.5 : -1.5}deg)`, opacity: Math.min(1, p * 1.5) }}>
              <Img src={x.logo ? staticFile('logos/monad.png') : ls('logo.webp')} className="h-[62px] w-[62px]" />
              <span className="font-display text-[36px] leading-none">{x.t}</span>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/* ---------------------------------------------------------------- beat 3: IRL */

/** A photo pinned like a polaroid. */
function Polaroid({ src, cap, x, y, w, r, at, fit = 'cover' }: { src: string; cap: string; x: number; y: number; w: number; r: number; at: number; fit?: 'cover' | 'contain' }) {
  const F = useCurrentFrame()
  const p = pop(F, at, 9, 190)
  const h = Math.round(w * 0.72)
  return (
    <div className="absolute rounded-[10px] bg-white p-4 pb-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)]" style={{ left: x, top: y, width: w + 32, transform: `rotate(${r + (1 - p) * 25}deg) scale(${0.4 + 0.6 * p})`, opacity: Math.min(1, p * 1.6) }}>
      <div className="overflow-hidden rounded-[4px] bg-grape-950" style={{ height: h }}>
        <Img src={src} className="h-full w-full" style={{ objectFit: fit, transform: `scale(${interpolate(F - at, [0, 120], [1.04, 1.12], clamp)})` }} />
      </div>
      <div className="mt-2 text-center text-[30px] font-bold text-grape-800" style={{ fontFamily: 'var(--font-display)' }}>
        {cap}
      </div>
      <span className="absolute -top-4 left-1/2 h-8 w-24 -translate-x-1/2 rotate-[-4deg] bg-ember-300/80" />
    </div>
  )
}

function Irl({ at }: { at: number }) {
  const F = useCurrentFrame()
  return (
    <AbsoluteFill>
      <Polaroid src={staticFile('lilstars/merch/NewsMerch.jpg')} cap="holder merch, unboxed" x={80} y={110} w={680} r={-5} at={at + 2} />
      <Polaroid src={staticFile('lilstars/merch/NewsW3W.jpg')} cap="first IRL event · Jakarta" x={860} y={80} w={430} r={4} at={at + 16} fit="contain" />
      <Polaroid src={staticFile('lilstars/merch/NewsLootgoIRL.jpg')} cap="collabs" x={820} y={530} w={400} r={-3} at={at + 30} />
      <div className="absolute left-[110px] top-[720px] title-outline text-[78px]" style={{ color: '#ffd27a', transform: `scale(${pop(F, at + 40, 8, 260)}) rotate(-4deg)` }}>
        IRL too!
      </div>
    </AbsoluteFill>
  )
}

/* ---------------------------------------------------------------- beat 4: press */

const PRESS = [
  { who: 'Backpack Learn', q: 'gained traction for its playful art style and community engagement', icon: 'merch/NewsBackpack.jpg' },
  { who: 'PANews', q: 'the Monad community also naturally likes this NFT project', icon: null },
  { who: 'NFT Evening', q: 'Top 5 Monad NFT Projects Worth Watching', icon: null },
]

function Press({ at, end }: { at: number; end: number }) {
  const F = useCurrentFrame()
  const step = Math.max(14, Math.round((end - at) / (PRESS.length + 1)))
  return (
    <AbsoluteFill>
      <div className="absolute left-[90px] top-[70px] title-outline text-[74px]" style={{ transform: `scale(${pop(F, at, 9, 240)}) rotate(-3deg)` }}>
        people noticed
      </div>
      {PRESS.map((x, i) => {
        const a = at + 8 + i * step
        const p = pop(F, a, 10, 210)
        return (
          <div key={x.who} className={`${card} absolute flex w-[1180px] items-center gap-6 px-8 py-6`} style={{ left: 120 + i * 70, top: 230 + i * 210, transform: `translateX(${(1 - p) * 900}px) rotate(${[-1.5, 1.2, -1][i]}deg)`, opacity: Math.min(1, p * 1.5) }}>
            <span className="font-display text-[120px] leading-[0.6] text-candy-500">&ldquo;</span>
            <div className="flex-1">
              <div className="text-[40px] font-bold leading-tight text-grape-900">{x.q}</div>
              <div className="mt-2 text-[26px] font-extrabold uppercase tracking-widest text-grape-600">{x.who}</div>
            </div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

function FindThem({ at }: { at: number }) {
  const F = useCurrentFrame()
  return (
    <>
      <Browser src={site('home.png')} url="lilstars.xyz" at={at} x={800} y={110} w={860} tilt={2} />
      <div className="absolute left-[110px] top-[170px]">
        <div className="title-outline mb-8 text-[80px]" style={{ transform: `scale(${pop(F, at, 9, 240)}) rotate(-3deg)` }}>
          find the Stars
        </div>
        <LilStarsLinks at={at + 8} />
      </div>
    </>
  )
}
