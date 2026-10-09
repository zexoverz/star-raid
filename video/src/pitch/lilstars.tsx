/**
 * "Who are the Lil Stars?" One beat per spoken line. Only official Lil Stars material, unaltered:
 * the animated crew art and logos from lilstars.xyz (public/art/lilstars) and screenshots of the
 * site (public/lilstars/site). Every claim is from lilstars.xyz (About + Characters pages).
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { clamp } from '../ui'

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
      {/* 1. what it is: born on Monad, formerly Chogstar, + About page */}
      {vis(1) && (
        <>
          <Browser src={site('about-us.png')} url="lilstars.xyz" at={c(1)} x={760} y={100} w={900} tilt={2} />
          <div className="absolute left-[90px] top-[150px] flex w-[620px] flex-col gap-5">
            {[
              { t: 'digital collectible IP', d: 'one universe, one crew', at: c(1) + 6 },
              { t: 'born on Monad', d: 'stored on Monad since day 1', at: c(1) + 22, logo: true },
              { t: 'formerly Chogstar', d: 'grown from the community', at: c(1) + 38 },
            ].map((x, i) => {
              const p = pop(F, x.at, 10, 220)
              return (
                <div key={x.t} className={`${card} flex items-center gap-5 px-6 py-4`} style={{ transform: `translateX(${(1 - p) * -500}px) rotate(${i % 2 ? 1.5 : -1.5}deg)`, opacity: Math.min(1, p * 1.5) }}>
                  {x.logo ? <Img src={staticFile('logos/monad.png')} className="h-[70px] w-[70px]" /> : <Img src={ls('logo.webp')} className="h-[70px] w-[70px]" />}
                  <div>
                    <div className="font-display text-[44px] leading-none">{x.t}</div>
                    <div className="mt-1 text-[24px] font-semibold text-grape-700">{x.d}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
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
      {/* 3. growing off-chain: IRL blind boxes + merch (their words: "exploring how Lilstars can live in Web2") */}
      {vis(3) && (
        <>
          <Browser src={site('collection.png')} url="lilstars.xyz · collection" at={c(3)} x={110} y={110} w={1000} tilt={-2} />
          <div className="absolute left-[1180px] top-[150px] flex w-[620px] flex-col gap-6">
            {[
              { t: 'IRL blind boxes', icon: 'chest_closed.webp', at: c(3) + 14 },
              { t: 'limited merch', icon: 'medal_gold.webp', at: c(3) + 30 },
              { t: 'for loyal holders', icon: 'seat_ticket.webp', at: c(3) + 46 },
            ].map((x, i) => {
              const p = pop(F, x.at, 9, 240)
              return (
                <div key={x.t} className={`${card} flex items-center gap-5 px-6 py-4`} style={{ transform: `scale(${p}) rotate(${i % 2 ? 2 : -2}deg)` }}>
                  <Img src={staticFile(`art/${x.icon}`)} className="h-[90px] w-[90px]" />
                  <div className="font-display text-[48px] leading-none">{x.t}</div>
                </div>
              )
            })}
          </div>
        </>
      )}
      {/* 4. motto */}
      {vis(4) && (
        <AbsoluteFill className="items-center justify-center pr-[460px]">
          <div className="flex items-end gap-2">
            {CREW.map((m, i) => (
              <Img key={m.name} src={ls(m.art)} className="h-[300px] w-auto" style={{ transform: `translateY(${(1 - pop(F, c(4) + i * 4, 9, 220)) * 400 - Math.abs(Math.sin((F - i * 5) / 6)) * 16}px)` }} />
            ))}
          </div>
          <div className="title-outline mt-6 text-center text-[88px] leading-[1.05]" style={{ color: '#ffd27a', transform: `scale(${pop(F, c(4) + 14, 8, 260)}) rotate(-3deg)` }}>
            everyone can be a star
          </div>
        </AbsoluteFill>
      )}
      {/* 5. in Star Raid, your Lil Star is your seat */}
      {vis(5) && (
        <AbsoluteFill className="items-center justify-center pr-[300px]">
          <div className="flex items-center gap-10">
            <div className={`${card} p-5`} style={{ transform: `rotate(-4deg) scale(${pop(F, c(5), 10, 220)})` }}>
              <Img src={ls('Chogstar.webp')} className="h-[320px] w-auto" />
              <div className="mt-2 text-center font-display text-[36px]">your Lil Star</div>
            </div>
            <div className="title-outline text-[130px]" style={{ transform: `scale(${pop(F, c(5) + 10, 8, 300)})` }}>
              =
            </div>
            <div className={`${card} p-5`} style={{ transform: `rotate(4deg) scale(${pop(F, c(5) + 18, 10, 220)})` }}>
              <Img src={staticFile('art/seat_ticket.webp')} className="h-[320px] w-[320px]" />
              <div className="mt-2 text-center font-display text-[36px]">one raid seat</div>
            </div>
          </div>
        </AbsoluteFill>
      )}
      {/* 6. where to find them */}
      {F >= c(6) - 2 && <FindThem at={c(6)} />}
      {/* beat dots */}
      <div className="absolute left-1/2 top-[22px] flex -translate-x-1/2 gap-3">
        {cues.map((_, i) => (
          <span key={i} className="h-[12px] w-[44px] rounded-full border-[3px] border-grape-800" style={{ background: i <= beat ? '#ffb84d' : '#2d2250' }} />
        ))}
      </div>
    </AbsoluteFill>
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
