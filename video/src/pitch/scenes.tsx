import { AbsoluteFill, getStaticFiles, Html5Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import { pose, type Who } from '../assets'
import { fmt, RAID } from '../data'
import { SITE } from '../scenes/Cta'
import { clamp, Twinkles } from '../ui'
import { BG, Chip, cue, ease, Face, FPS, frames, Phone, Slam, sec, Sticker, usePopAt, Voice, type Section } from './parts'
import { Captions, LineTicks, Punch, Stickers, useDrift } from './hype'
import { Diagram } from './diagram'
import { DemoPanels } from './demo-fx'
import { LilStarsLinks, LilStarsPanel } from './lilstars'

// GPT-drawn doodles (scripts/doodles.sh); a box without one just shows its label
const DOODLE_NAMES = ['raider', 'router', 'kuru', 'gate', 'vault', 'pyth', 'settle'] as const
const DOODLES: Record<string, string | undefined> = Object.fromEntries(
  DOODLE_NAMES.map((n) => [n, getStaticFiles().some((f) => f.name === `doodle/${n}.png`) ? `doodle/${n}.png` : undefined]),
)

const art = (p: string) => staticFile(`art/${p}`)
const rec = (c: string) => `rec/phone/${c}.mp4`

function Shell({ s, bg, children, face, faceAmount, stickers = true }: { s: Section; bg?: object; children?: React.ReactNode; face?: boolean; faceAmount?: number; stickers?: boolean }) {
  // over a full-frame face the graphics sit on top of him; with the corner circle they sit underneath
  const over = face && (faceAmount ?? 1) < 0.5
  const drift = useDrift()
  return (
    <AbsoluteFill style={bg ?? BG.grape}>
      <AbsoluteFill className="opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#2d2250 3px, transparent 3.5px)', backgroundSize: '44px 44px', ...drift }} />
      <Punch s={s}>
        {face && <Face s={s} amount={faceAmount ?? 1} />}
        <AbsoluteFill style={{ zIndex: over ? 40 : 20 }}>{children}</AbsoluteFill>
      </Punch>
      <Stickers s={s} skip={!stickers} />
      <LineTicks s={s} />
      <Voice s={s} />
      <Captions s={s} />
    </AbsoluteFill>
  )
}

/* 1. Hook: him, full frame, phone in hand. */
export function Hook() {
  const s = sec('hook')
  return <Shell s={s} face faceAmount={0} />
}

/* 2. Logo sting: wordmark lands, crew bounces, music swells (the bed is louder here). */
export function Sting() {
  const frame = useCurrentFrame()
  const p = usePopAt(4, { damping: 9, stiffness: 140 })
  const crew: Who[] = ['chog', 'bunny', 'fox', 'bear']
  return (
    <AbsoluteFill style={BG.grape}>
      <Img src={art('hero_scene.webp')} className="absolute inset-0 h-full w-full object-cover opacity-55" style={{ transform: `scale(${interpolate(frame, [0, 150], [1.12, 1.02], clamp)})`, objectPosition: '30% 60%' }} />
      <Twinkles count={18} seed={2} />
      <Sequence from={2} layout="none">
        <Html5Audio src={staticFile('audio/kit/reveal.mp3')} volume={0.7} />
      </Sequence>
      <AbsoluteFill className="items-center justify-center">
        <Img src={art('wordmark.svg')} className="h-[440px] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]" style={{ transform: `scale(${0.3 + 0.7 * p}) rotate(${(1 - p) * -14}deg)`, opacity: p }} />
        <div className="mt-2 flex items-end gap-3">
          {crew.map((w, i) => (
            <Img key={w} src={pose(w, 'cheer')} className="h-[190px] w-auto drop-shadow-[0_10px_8px_rgba(0,0,0,0.45)]" style={{ transform: `translateY(${-Math.abs(Math.sin((frame - 20 - i * 4) / 6)) * 26}px)`, opacity: ease(frame, 18 + i * 3, 30 + i * 3) }} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* 3. Problem: full frame, then he shrinks to the corner and three sticker cards land. */
export function Problem() {
  const s = sec('problem')
  const frame = useCurrentFrame()
  const go = cue(s, 1) - 8
  const k = ease(frame, go, go + 14)
  const cards = [
    { at: cue(s, 1), icon: 'bot.webp', title: 'Bots farm the rewards', tilt: -3 },
    { at: cue(s, 2), icon: 'hourglass.webp', title: 'Snipers wait for the last second', tilt: 2 },
    { at: cue(s, 3), icon: 'flag_sponsor.webp', title: "Sponsors can't tell who's real", tilt: -2 },
  ]
  const turn = cue(s, 4)
  return (
    <Shell s={s} bg={BG.checker} face faceAmount={k}>
      <div className="absolute left-24 top-20" style={{ opacity: ease(frame, go + 4, go + 14) }}>
        <Sticker at={go + 4} className="px-8 py-3" tilt={-2} from="left">
          <div className="font-display text-[54px] leading-none">Community buys are broken</div>
        </Sticker>
      </div>
      <div className="absolute left-24 top-[240px] flex w-[1300px] flex-col gap-6">
        {cards.map((c, i) => (
          <div key={c.title} style={{ marginLeft: i * 60, filter: frame > turn ? 'saturate(0.35) brightness(0.92)' : undefined }}>
            <Sticker at={c.at} className="flex w-[760px] items-center gap-6 px-7 py-4" tilt={c.tilt} from="left">
              <Img src={art(c.icon)} className="h-24 w-24 object-contain" />
              <div className="font-display text-[44px] leading-tight">{c.title}</div>
            </Sticker>
          </div>
        ))}
      </div>
      <div className="absolute left-[1090px] top-[240px] flex w-[440px] flex-col items-start gap-5">
        <Sticker at={turn} className="bg-grape-800 px-6 py-3 text-cream-100" tilt={3} from="pop">
          <div className="font-display text-[34px] text-grape-300 line-through decoration-candy-500 decoration-[5px]">not everyone can trade</div>
        </Sticker>
        <Sticker at={cue(s, 5)} className="bg-ember-400 px-7 py-4" tilt={-3} from="pop">
          <div className="font-display text-[46px] leading-tight text-grape-900">anyone can play a game</div>
        </Sticker>
      </div>
    </Shell>
  )
}

/* 4. Built in 5 days: him full frame, a "5 DAYS" stamp. */
export function Days() {
  const s = sec('days')
  const at = Math.round(s.dur * FPS * 0.35)
  return (
    <Shell s={s} face faceAmount={0}>
      <div className="absolute inset-x-0 top-[50%] flex justify-center">
        <Slam at={at} size={190}>
          5 DAYS
        </Slam>
      </div>
      <div className="absolute inset-x-0 top-[71%] flex justify-center">
        <Sticker at={at + 10} className="px-7 py-2" tilt={2} from="pop">
          <div className="font-display text-[36px]">Monad Metropolis 2026 · Track 01</div>
        </Sticker>
      </div>
    </Shell>
  )
}

/* 5. Meet Star Raid: phone mockup, one-line value, the crew. */
export function Meet() {
  const s = sec('meet')
  const frame = useCurrentFrame()
  return (
    <Shell s={s} bg={BG.lavender} face>
      <div className="absolute left-24 top-24 w-[860px]">
        <Sticker at={4} className="inline-block px-6 py-2" tilt={-2} from="left">
          <div className="font-display text-[40px]">Meet</div>
        </Sticker>
        <Img src={art('wordmark-h.svg')} className="mt-4 h-[200px] w-auto drop-shadow-[0_10px_0_#2d2250]" style={{ opacity: ease(frame, 8, 20), transform: `scale(${0.8 + 0.2 * ease(frame, 8, 22)})` }} />
        <Sticker at={cue(s, 0) + 6} className="mt-6 px-7 py-5" tilt={1}>
          <div className="font-display text-[44px] leading-tight">A co-op raid game on a real on-chain order book</div>
        </Sticker>
        <div className="mt-6 flex gap-4">
          <Sticker at={cue(s, 1)} className="flex items-center gap-3 px-5 py-3" tilt={-2} from="pop">
            <Img src={art('flag_sponsor.webp')} className="h-14 w-14" />
            <span className="font-display text-[30px]">Sponsor posts a wall</span>
          </Sticker>
          <Sticker at={cue(s, 2)} className="flex items-center gap-3 px-5 py-3" tilt={2} from="pop">
            <Img src={art('seat_ticket.webp')} className="h-14 w-14" />
            <span className="font-display text-[30px]">Stars break it together</span>
          </Sticker>
        </div>
      </div>
      <div className="absolute right-[430px] top-[70px]">
        <Phone height={860} cuts={[{ src: rec('lobby'), from: 0.2, at: 0 }]} />
      </div>
    </Shell>
  )
}

/* 6. Demo: the phone does the talking; a caption sticker per line. */
export function Demo() {
  const s = sec('demo')
  const c = (i: number) => cue(s, i)
  const steps = [
    { at: c(0), k: 'The lobby', d: 'next raid, live countdown' },
    { at: c(1), k: 'Sponsor', d: 'wall, cap price, USDC prize' },
    { at: c(2), k: 'One Star, one seat', d: 'the whole bot defence' },
    { at: c(3), k: 'Set up once', d: 'then every raid is one tap' },
    { at: c(4), k: 'HIT!', d: 'every hit is a real buy' },
    { at: c(5), k: 'The draw', d: 'end block, every hit checked' },
  ]
  return (
    <Shell s={s} bg={BG.grape} stickers={false}>
      <Twinkles count={12} seed={9} />
      <div className="absolute left-[110px] top-[60px]">
        <Phone
          height={860}
          cuts={[
            { src: rec('lobby'), from: 0.2, at: 0 },
            { src: rec('board'), from: 1.0, at: c(1) },
            { src: rec('practice'), from: 0, at: c(2) },
            { src: rec('practice'), from: 1.0, at: c(3) },
            { src: rec('practice'), from: 6.0, at: c(4) },
            { src: rec('raid'), from: 19.0, at: c(5) },
          ]}
        />
      </div>
      {s.face === 'none' && <DemoPanels cues={steps.map((x) => x.at)} total={frames(s)} />}
      <Sequence from={c(4)} layout="none">
        <Html5Audio src={staticFile('audio/kit/combo.mp3')} volume={0.35} />
      </Sequence>
    </Shell>
  )
}

/* 6b. Rules: one raid as a timeline, the game mechanics in one picture. */
export function Rules() {
  const s = sec('rules')
  const frame = useCurrentFrame()
  const c = (i: number) => cue(s, i)
  // the track: open -> live (hits land) -> danger zone -> end block drawn
  const x0 = 140
  const x1 = 1460
  const danger = 0.72
  const endAt = 0.86
  const head = interpolate(frame, [c(2), c(4) + 10], [0, 1], clamp)
  const hx = x0 + (x1 - x0) * head
  const dropped = frame >= c(4) + 6
  const won = frame >= c(5)
  const lost = frame >= c(6)
  const hits = Array.from({ length: 14 }, (_, i) => ({ t: 0.06 + (i / 14) * 0.9 + ((i * 37) % 7) * 0.004, late: 0.06 + (i / 14) * 0.9 > endAt }))
  const boss = won && !lost ? 'wall_boss_ko.webp' : head > 0.45 ? 'wall_boss_hurt.webp' : 'wall_boss.webp'
  return (
    <Shell s={s} bg={BG.mint} face>
      <div className="absolute left-24 top-12">
        <Sticker at={2} className="px-7 py-3" tilt={-2} from="left">
          <div className="font-display text-[50px]">How a raid plays</div>
        </Sticker>
      </div>
      {/* the wall and the prize */}
      <div className="absolute left-[150px] top-[170px] flex items-end gap-8">
        <Sticker at={c(1)} className="flex items-center gap-4 px-5 py-3" tilt={-1} from="pop">
          <Img src={art(boss)} className="h-36 w-36" style={{ transform: `translateX(${frame >= c(2) && frame < c(4) ? Math.sin(frame * 1.7) * 4 : 0}px)` }} />
          <div>
            <div className="font-display text-[38px] leading-none">The wall</div>
            <div className="text-[24px] font-semibold text-grape-700">sponsor token at one price</div>
          </div>
        </Sticker>
        <Sticker at={c(1) + 8} className="flex items-center gap-4 px-5 py-3" tilt={2} from="pop">
          <Img src={art(won && !lost ? 'chest_open.webp' : 'chest_closed.webp')} className="h-28 w-28" />
          <div>
            <div className="font-display text-[38px] leading-none">The prize</div>
            <div className="text-[24px] font-semibold text-grape-700">USDC, only for seats</div>
          </div>
        </Sticker>
      </div>
      {/* the timeline */}
      <div className="absolute left-0 top-[520px] h-[200px] w-[1600px]" style={{ opacity: ease(frame, c(2) - 6, c(2) + 6) }}>
        <div className="absolute h-9 rounded-full border-[5px] border-grape-800 bg-cream-100 shadow-[0_6px_0_#2d2250]" style={{ left: x0, width: x1 - x0, top: 70 }} />
        <div className="absolute h-9 rounded-r-full" style={{ left: x0 + (x1 - x0) * danger, width: (x1 - x0) * (1 - danger), top: 70, background: 'repeating-linear-gradient(-45deg,#e826b1 0 12px,#aa3686 12px 24px)', opacity: ease(frame, c(3) - 4, c(3) + 8) }} />
        <div className="absolute font-display text-[30px] text-candy-600" style={{ left: x0 + (x1 - x0) * danger + 8, top: 18, opacity: ease(frame, c(3), c(3) + 8) }}>
          ☠ danger zone
        </div>
        <div className="absolute font-display text-[30px] text-grape-800" style={{ left: x0, top: 18 }}>
          window opens · tap HIT
        </div>
        {hits.map((h, i) => {
          const hxi = x0 + (x1 - x0) * h.t
          if (hxi > hx) return null
          const out = dropped && h.late
          return (
            <div key={i} className="absolute" style={{ left: hxi - 18, top: 64, opacity: out ? 0.35 : 1, filter: out ? 'grayscale(1)' : undefined }}>
              <Img src={art('hit_spark.webp')} className="h-12 w-12" />
              {out && <div className="absolute -top-1 left-2 font-display text-[34px] text-grape-800">✕</div>}
            </div>
          )
        })}
        <div className="absolute w-[6px] rounded bg-sky" style={{ left: hx - 3, top: 50, height: 76, boxShadow: '0 0 12px #b6d6f7', opacity: head > 0 && head < 1 ? 1 : 0 }} />
        {dropped && (
          <div className="absolute" style={{ left: x0 + (x1 - x0) * endAt - 46, top: 116 }}>
            <Sticker at={c(4) + 6} className="flex items-center gap-2 bg-ember-300 px-4 py-2" tilt={-3} from="pop">
              <Img src={art('dice_block.webp')} className="h-12 w-12" />
              <span className="font-display text-[28px]">end block (Pyth)</span>
            </Sticker>
          </div>
        )}
        {dropped && <div className="absolute w-[8px] rounded bg-ember-500" style={{ left: x0 + (x1 - x0) * endAt - 4, top: 46, height: 80 }} />}
      </div>
      {/* the outcome */}
      <div className="absolute bottom-[140px] left-[150px] flex gap-6">
        <Sticker at={c(5)} className="flex items-center gap-4 bg-mint px-6 py-3" tilt={-2} from="pop">
          <Img src={art('trophy.webp')} className="h-16 w-16" />
          <span className="font-display text-[32px]">target hit: seats split the prize</span>
        </Sticker>
        <Sticker at={c(6)} className="flex items-center gap-4 px-6 py-3" tilt={2} from="pop">
          <Img src={art('lock.webp')} className="h-16 w-16" />
          <span className="font-display text-[32px]">missed: prize rolls to the next raid</span>
        </Sticker>
      </div>
    </Shell>
  )
}

/* 5b. Who are the Lil Stars: what it is, the crew, off-chain IP, links. Him in the corner. */
export function LilStars() {
  const s = sec('lilstars')
  return (
    <Shell s={s} bg={BG.grape} face stickers={false}>
      <Twinkles count={14} seed={7} />
      <LilStarsPanel cues={s.cues.map((_, i) => cue(s, i))} total={frames(s)} />
    </Shell>
  )
}

/* 7. How it works: an Excalidraw-style architecture sketch that draws itself, then real raid #26 numbers. */
export function How() {
  const s = sec('how')
  // cues: 0 Kuru buy, 1 cancel + refund, 2 Pyth end, 3 only seats count, 4 no Lil Star, 5 raid #26
  const c = { kuru: cue(s, 0), cancel: cue(s, 1), pyth: cue(s, 2), seats: cue(s, 3), noSeat: cue(s, 4), result: cue(s, 2) + 70 }
  return (
    <Shell s={s} face stickers={false}>
      <Diagram c={c} icons={DOODLES} />
      <div className="absolute bottom-[170px] left-[90px]">
        <Sticker at={cue(s, 5)} className="flex items-center gap-6 bg-mint px-7 py-4" tilt={-2} from="pop">
          <Img src={art('trophy.webp')} className="h-20 w-20" />
          <div>
            <div className="text-[22px] font-extrabold uppercase tracking-widest text-grape-700">Testnet raid #{RAID.id} · wall broken</div>
            <div className="font-display text-[46px] leading-tight">
              {RAID.countedHits} hits · {fmt(RAID.counted)} / {fmt(RAID.target)} counted
            </div>
          </div>
        </Sticker>
      </div>
    </Shell>
  )
}

/* 8. Why Monad, Kuru, Pyth: him full frame, keywords slam in. */
export function Why() {
  const s = sec('why')
  const words = [
    { at: cue(s, 0) + 20, t: 'FAST BLOCKS', c: '#ffb84d', pos: 'left-[8%] top-[16%]', logo: 'monad' },
    { at: cue(s, 1) + 20, t: 'ON-CHAIN ORDER BOOK', c: '#f7b2d9', pos: 'right-[6%] top-[22%]', logo: 'kuru' },
    { at: cue(s, 2) + 18, t: 'A FAIR END', c: '#a3e3c1', pos: 'left-[10%] top-[58%]', logo: 'pyth' },
  ]
  const frame = useCurrentFrame()
  return (
    <Shell s={s} face faceAmount={0} stickers={false}>
      {words.map((w, i) => {
        const next = words[i + 1]?.at ?? 1e9
        const fade = interpolate(frame, [next, next + 10], [1, 0], clamp)
        const lp = spring({ frame: frame - (w.at - 6), fps: FPS, config: { damping: 9, stiffness: 200 } })
        return (
          <div key={w.t} className={`absolute ${w.pos} flex items-center gap-6`} style={{ opacity: fade }}>
            {frame >= w.at - 6 && (
              <div className="grid h-[150px] w-[150px] shrink-0 place-items-center rounded-full border-[6px] border-grape-800 bg-white shadow-[0_8px_0_#2d2250]" style={{ transform: `scale(${lp}) rotate(${(1 - lp) * -40}deg)` }}>
                <Img src={staticFile(`logos/${w.logo}.png`)} className="h-[104px] w-[104px] object-contain" />
              </div>
            )}
            <Slam at={w.at} color={w.c} size={108}>
              {w.t}
            </Slam>
          </div>
        )
      })}
      <div className="absolute right-[5%] top-[80%] flex gap-4" style={{ opacity: ease(frame, cue(s, 0), cue(s, 0) + 10) }}>
        {[
          { n: 'Monad', l: 'monad' },
          { n: 'Kuru', l: 'kuru' },
          { n: 'Pyth', l: 'pyth' },
        ].map((x, i) => (
          <Sticker key={x.n} at={cue(s, i) + 4} className="flex items-center gap-3 px-5 py-2" tilt={i % 2 ? 2 : -2} from="pop">
            <Img src={staticFile(`logos/${x.l}.png`)} className="h-[48px] w-[48px] rounded-lg object-contain" />
            <span className="font-display text-[34px]">{x.n}</span>
          </Sticker>
        ))}
      </div>
    </Shell>
  )
}

/* 9. Roadmap: what's next 01 / 02 / 03. */
export function Roadmap() {
  const s = sec('roadmap')
  const items = [
    { at: cue(s, 1), n: '01', t: 'MAINNET', d: 'from Monad testnet to mainnet' },
    { at: cue(s, 2), n: '02', t: 'PASSKEY SIGN-IN', d: 'join without installing a wallet' },
    { at: cue(s, 3), n: '03', t: 'MORE WALLS', d: 'any sponsor token, starting with LSTs' },
  ]
  return (
    <Shell s={s} bg={BG.checker} face>
      <div className="absolute left-24 top-14">
        <Sticker at={2} className="px-7 py-3" tilt={-2} from="left">
          <div className="font-display text-[56px]">What's next?</div>
        </Sticker>
      </div>
      <div className="absolute left-24 top-[175px]">
        <Sticker at={cue(s, 0)} className="flex items-center gap-3 bg-mint px-5 py-2" tilt={1} from="pop">
          <span className="h-4 w-4 rounded-full bg-[#1f9d55]" />
          <span className="font-display text-[30px]">Live on Monad testnet now</span>
        </Sticker>
      </div>
      <div className="absolute left-24 top-[270px] flex w-[980px] flex-col gap-5">
        {items.map((x, i) => (
          <Sticker key={x.n} at={x.at} className="flex items-center gap-6 px-6 py-4" tilt={i % 2 ? 1 : -1} from="left">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-grape-800 font-display text-[40px] text-ember-300">{x.n}</span>
            <div>
              <div className="font-display text-[44px] leading-none text-candy-600">{x.t}</div>
              <div className="mt-1 text-[26px] font-semibold text-grape-700">{x.d}</div>
            </div>
          </Sticker>
        ))}
      </div>
      <div className="absolute bottom-[150px] left-24">
        <Sticker at={cue(s, 4)} className="flex items-center gap-4 bg-ember-300 px-6 py-3" tilt={-1} from="pop">
          <Img src={art('sparkle.webp')} className="h-14 w-14" />
          <span className="font-display text-[32px]">Something the Monad community would love to play</span>
        </Sticker>
      </div>
      <div className="absolute right-[420px] top-[60px]">
        <Phone height={760} cuts={[{ src: rec('practice'), from: 6.0, at: 0 }]} />
      </div>
    </Shell>
  )
}

/* 10. Close: him full frame, then the end card. */
export function Close() {
  const s = sec('close')
  const frame = useCurrentFrame()
  const end = Math.round((s.talk ?? s.dur) * FPS)
  const card = ease(frame, end - 4, end + 12)
  return (
    <AbsoluteFill style={BG.grape}>
      <Face s={s} amount={0} />
      <Voice s={s} />
      {frame < end && <Captions s={s} />}
      {frame >= end - 6 && (
        <AbsoluteFill style={{ opacity: card, zIndex: 45 }}>
          <EndCard start={end} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

function EndCard({ start }: { start: number }) {
  const frame = useCurrentFrame() - start
  const crew: Who[] = ['chog', 'bunny', 'fox', 'bear']
  return (
    <AbsoluteFill style={BG.grape}>
      <Img src={art('hero_scene.webp')} className="absolute inset-0 h-full w-full object-cover opacity-35" style={{ objectPosition: '30% 60%' }} />
      <Twinkles count={18} seed={4} />
      <AbsoluteFill className="items-center justify-center">
        <div className="title-outline text-[110px] leading-none" style={{ transform: 'rotate(-3deg)' }}>
          PLAY
        </div>
        <Img src={art('wordmark-h.svg')} className="mt-2 h-[230px] w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]" />
        <div className="mt-4 flex items-end gap-2">
          {crew.map((w, i) => (
            <Img key={w} src={pose(w, 'cheer')} className="h-[150px] w-auto" style={{ transform: `translateY(${-Math.abs(Math.sin((frame - i * 4) / 6)) * 20}px)` }} />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-4">
          <span className="text-[30px] font-bold text-cream-100">play at</span>
          <Chip className="!bg-ember-400 !text-[34px] text-white">{SITE}</Chip>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <span className="text-[26px] font-bold text-cream-100">Lil Stars</span>
          <LilStarsLinks at={start + 20} compact />
        </div>
        <div className="absolute bottom-10 text-center text-[22px] text-grape-300">Built in 5 days for Monad Metropolis 2026 · Kuru · Pyth Entropy · Lil Stars art by the Lil Stars team</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export const PITCH_SCENES = [
  { id: 'hook', C: Hook },
  { id: 'sting', C: Sting },
  { id: 'problem', C: Problem },
  { id: 'days', C: Days },
  { id: 'meet', C: Meet },
  { id: 'lilstars', C: LilStars },
  { id: 'demo', C: Demo },
  { id: 'rules', C: Rules },
  { id: 'how', C: How },
  { id: 'why', C: Why },
  { id: 'roadmap', C: Roadmap },
  { id: 'close', C: Close },
].map((x) => ({ ...x, frames: frames(sec(x.id)) }))
