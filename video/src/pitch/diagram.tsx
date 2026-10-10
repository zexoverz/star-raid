/**
 * "How it works" as an Excalidraw sketch that draws itself while he talks.
 *
 * Look: rough.js strokes (the library Excalidraw itself uses, "sloppiness: artist"), Excalifont
 * text, hachure fills, a stickman raider who walks in and taps HIT, and coins that hop along the
 * arrows. Every box is a real part of the system (docs/plan/DESIGN.md, contracts/src):
 * RaidRouter buys on Kuru at the cap and cancels the rest, SeatGate checks the Lil Star,
 * RaidVault holds the prize and asks Pyth Entropy for the end block, then settles.
 * Partner logos (Monad, Kuru, Pyth) are shown unaltered; see public/logos/SOURCES.md.
 */
import { useMemo } from 'react'
import { AbsoluteFill, cancelRender, continueRender, delayRender, Html5Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame } from 'remotion'
import rough from 'roughjs'
import { clamp } from '../ui'
import { Sfx } from './parts'

/* ------------------------------------------------------------------ font */

const HAND = 'Excalifont'
// check() is true for an unregistered family, so track our own load instead
let fontLoading = false
if (typeof document !== 'undefined' && !fontLoading) {
  fontLoading = true
  const h = delayRender('Excalifont')
  const face = new FontFace(HAND, `url(${staticFile('fonts/Excalifont-Regular.woff2')}) format('woff2')`)
  face
    .load()
    .then((f) => {
      ;(document.fonts as unknown as { add: (f: FontFace) => void }).add(f)
      continueRender(h)
    })
    .catch((e) => cancelRender(e))
}

/* ----------------------------------------------------------------- rough */

const INK = '#1e1e1e'
const gen = rough.generator()
type P = { d: string; stroke: string; fill: string; w: number }
const paths = (drawable: ReturnType<typeof gen.rectangle>): P[] =>
  gen.toPaths(drawable).map((p) => ({ d: p.d, stroke: p.stroke, fill: p.fill ?? 'none', w: p.strokeWidth }))

/** Rough shapes, memoised per seed so the sketch stays put frame to frame. */
function useRough<T>(key: string, make: () => T): T {
  return useMemo(make, [key])
}

/* ------------------------------------------------------------------ boxes */

type BoxSpec = { id: string; x: number; y: number; w: number; h: number; title: string; sub?: string; fill: string; icon?: string; logo?: string; at: number }

function Box({ b, frame, seed }: { b: BoxSpec; frame: number; seed: number }) {
  const ps = useRough(`box${b.id}`, () => {
    const hach = paths(gen.rectangle(b.x, b.y, b.w, b.h, { seed, roughness: 1.6, bowing: 1.4, stroke: 'none', fill: b.fill, fillStyle: 'hachure', hachureGap: 11, fillWeight: 2.2, hachureAngle: -41 }))
    const edge = paths(gen.rectangle(b.x, b.y, b.w, b.h, { seed: seed + 1, roughness: 1.7, bowing: 1.5, stroke: INK, strokeWidth: 3 }))
    return { hach, edge }
  })
  if (frame < b.at) return null
  const t = interpolate(frame, [b.at, b.at + 14], [0, 1], { ...clamp, easing: (x) => 1 - (1 - x) ** 2 })
  const fillT = interpolate(frame, [b.at + 8, b.at + 22], [0, 1], clamp)
  const textT = interpolate(frame, [b.at + 6, b.at + 14], [0, 1], clamp)
  const left = b.x + (b.icon || b.logo ? 112 : 20)
  return (
    <g>
      <g opacity={fillT}>
        {ps.hach.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={b.fill} strokeWidth={p.w} strokeLinecap="round" />
        ))}
      </g>
      {ps.edge.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={INK} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
      ))}
      <g opacity={textT}>
        {b.icon && <image href={staticFile(b.icon)} x={b.x + 10} y={b.y + (b.h - 92) / 2} width={92} height={92} style={{ mixBlendMode: 'multiply' }} />}
        <text x={left} y={b.y + (b.sub ? b.h / 2 - 2 : b.h / 2 + 12)} fontFamily={HAND} fontSize={32} fill={INK}>
          {b.title}
        </text>
        {b.sub && (
          <text x={left} y={b.y + b.h / 2 + 32} fontFamily={HAND} fontSize={21} fill="#4a4a6a">
            {b.sub}
          </text>
        )}
        {b.logo && <Logo src={b.logo} x={b.x + b.w - 50} y={b.y - 40} at={b.at + 12} frame={frame} />}
      </g>
    </g>
  )
}

/** A partner logo stuck on the corner of a box like a sticker. */
function Logo({ src, x, y, at, frame }: { src: string; x: number; y: number; at: number; frame: number }) {
  const p = spring({ frame: frame - at, fps: 30, config: { damping: 9, stiffness: 220 } })
  return (
    <g style={{ transformOrigin: `${x + 36}px ${y + 36}px`, transform: `scale(${p}) rotate(${(1 - p) * 30 + 6}deg)` }}>
      <circle cx={x + 36} cy={y + 36} r={38} fill="#fff" stroke={INK} strokeWidth={3} />
      <image href={staticFile(src)} x={x + 8} y={y + 8} width={56} height={56} />
    </g>
  )
}

/* ----------------------------------------------------------------- arrows */

type ArrowSpec = { id: string; from: [number, number]; to: [number, number]; bend?: number; label?: string; at: number; dashed?: boolean; color?: string; labelAt?: [number, number] }

const ctrl = (a: ArrowSpec): [number, number] => {
  const [x1, y1] = a.from
  const [x2, y2] = a.to
  const k = a.bend ?? 0
  return [(x1 + x2) / 2 - (y2 - y1) * k, (y1 + y2) / 2 + (x2 - x1) * k]
}
const onCurve = (a: ArrowSpec, t: number): [number, number] => {
  const [x1, y1] = a.from
  const [x2, y2] = a.to
  const [mx, my] = ctrl(a)
  const u = 1 - t
  return [u * u * x1 + 2 * u * t * mx + t * t * x2, u * u * y1 + 2 * u * t * my + t * t * y2]
}

function Arrow({ a, frame, seed }: { a: ArrowSpec; frame: number; seed: number }) {
  const col = a.color ?? INK
  const ps = useRough(`arrow${a.id}`, () => {
    const [x1, y1] = a.from
    const [x2, y2] = a.to
    const [mx, my] = ctrl(a)
    const body = paths(gen.path(`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`, { seed, roughness: 1.3, bowing: 1, stroke: col, strokeWidth: 3, strokeLineDash: a.dashed ? [12, 10] : undefined }))
    const ang = Math.atan2(y2 - my, x2 - mx)
    const hl = 22
    const head = paths(
      gen.linearPath(
        [
          [x2 - hl * Math.cos(ang - 0.5), y2 - hl * Math.sin(ang - 0.5)],
          [x2, y2],
          [x2 - hl * Math.cos(ang + 0.5), y2 - hl * Math.sin(ang + 0.5)],
        ],
        { seed: seed + 9, roughness: 1.2, stroke: col, strokeWidth: 3 },
      ),
    )
    return { body, head }
  })
  if (frame < a.at) return null
  const t = interpolate(frame, [a.at, a.at + 14], [0, 1], { ...clamp, easing: (x) => 1 - (1 - x) ** 2 })
  const [lx, ly] = a.labelAt ?? onCurve(a, 0.5)
  return (
    <g>
      {ps.body.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={col} strokeWidth={p.w} strokeLinecap="round" pathLength={a.dashed ? undefined : 1} strokeDasharray={a.dashed ? '12 10' : 1} strokeDashoffset={a.dashed ? 0 : 1 - t} opacity={a.dashed ? t : 1} />
      ))}
      {t > 0.92 &&
        ps.head.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={col} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      {a.label && (
        <text x={lx} y={ly - 14} textAnchor="middle" fontFamily={HAND} fontSize={26} fill={col} opacity={interpolate(frame, [a.at + 8, a.at + 16], [0, 1], clamp)} paintOrder="stroke" stroke="#fffdf7" strokeWidth={10} strokeLinejoin="round">
          {a.label}
        </text>
      )}
    </g>
  )
}

/** A USDC coin that hops along an arrow: lifts off, arcs, lands with a squash. Loops while `until`. */
function Coin({ a, at, until, every = 46, color = '#ffb84d', label = '$' }: { a: ArrowSpec; at: number; until: number; every?: number; color?: string; label?: string }) {
  const frame = useCurrentFrame()
  if (frame < at || frame > until) return null
  const k = (frame - at) % every
  const dur = 26
  if (k > dur + 4) return null
  const t = interpolate(k, [0, dur], [0, 1], { ...clamp, easing: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2) })
  const [x, y] = onCurve(a, t)
  const hop = Math.sin(Math.PI * t) * 26
  const land = interpolate(k, [dur, dur + 2, dur + 4], [1, 0.7, 1], clamp)
  const fade = interpolate(k, [0, 3, dur, dur + 4], [0, 1, 1, 0], clamp)
  return (
    <g transform={`translate(${x} ${y - hop - 16}) scale(${1 / land} ${land})`} opacity={fade}>
      <circle r={15} fill={color} stroke={INK} strokeWidth={3} />
      <text y={8} textAnchor="middle" fontFamily={HAND} fontSize={22} fill={INK}>
        {label}
      </text>
    </g>
  )
}

/* ---------------------------------------------------------------- stickman */

type Pose = 'walk' | 'tap' | 'cheer' | 'idle' | 'shrug'

/**
 * Hand-drawn stickman. `pose` picks the limbs, `t` is the frame for the cycle. Lines are slightly
 * wobbly (seeded) so he matches the rough.js boxes.
 */
function Stickman({ x, y, pose, t, scale = 1, color = INK, hat, press = 0 }: { x: number; y: number; pose: Pose; t: number; scale?: number; color?: string; hat?: 'star' | 'bot'; press?: number }) {
  const s = scale
  const w = Math.sin(t / 3.2)
  const head = 18 * s
  const neck: [number, number] = [0, -70 * s]
  const hip: [number, number] = [0, -20 * s]
  let lArm: [number, number] = [-24 * s, -40 * s]
  let rArm: [number, number] = [24 * s, -40 * s]
  let lLeg: [number, number] = [-16 * s, 18 * s]
  let rLeg: [number, number] = [16 * s, 18 * s]
  let bob = 0
  if (pose === 'walk') {
    lLeg = [-20 * w * s, 18 * s]
    rLeg = [20 * w * s, 18 * s]
    lArm = [18 * w * s, -38 * s]
    rArm = [-18 * w * s, -38 * s]
    bob = Math.abs(w) * 3 * s
  } else if (pose === 'tap') {
    rArm = [34 * s, (-58 + press * 16) * s]
    lArm = [-20 * s, -36 * s]
  } else if (pose === 'cheer') {
    const j = Math.abs(Math.sin(t / 4))
    lArm = [-28 * s, -96 * s]
    rArm = [28 * s, -96 * s]
    bob = -j * 14 * s
  } else if (pose === 'shrug') {
    lArm = [-30 * s, -66 * s]
    rArm = [30 * s, -66 * s]
  }
  const sh: [number, number] = [0, -58 * s]
  const line = (a: [number, number], b: [number, number], k: number) => {
    const mx = (a[0] + b[0]) / 2 + Math.sin(k * 7.1) * 1.6
    const my = (a[1] + b[1]) / 2 + Math.cos(k * 5.3) * 1.6
    return `M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`
  }
  return (
    <g transform={`translate(${x} ${y - bob})`} stroke={color} strokeWidth={4 * Math.max(0.8, s)} strokeLinecap="round" fill="none">
      <circle cx={0} cy={neck[1] - head} r={head} fill="#fffdf7" />
      {hat === 'star' && <text x={0} y={neck[1] - head * 2 - 2} textAnchor="middle" fontSize={30 * s} stroke="none" fill="#ffb84d">★</text>}
      {hat === 'bot' && <rect x={-head * 0.9} y={neck[1] - head * 2.05} width={head * 1.8} height={head * 1.2} rx={4} fill="#d9d4ea" />}
      <path d={line(neck, hip, 1)} />
      <path d={line(sh, lArm, 2)} />
      <path d={line(sh, rArm, 3)} />
      <path d={line(hip, lLeg, 4)} />
      <path d={line(hip, rLeg, 5)} />
    </g>
  )
}

/** Little phone the stickman holds, with a HIT button that flashes on each tap. */
function PhoneProp({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-8)`}>
      <rect x={0} y={0} width={34} height={58} rx={6} fill="#fffdf7" stroke={INK} strokeWidth={3} />
      <circle cx={17} cy={34} r={on ? 12 : 10} fill={on ? '#fd6b10' : '#ffd27a'} stroke={INK} strokeWidth={2.5} />
      {on && (
        <text x={44} y={8} fontFamily={HAND} fontSize={24} fill="#fd6b10">
          tap!
        </text>
      )}
    </g>
  )
}

/* ---------------------------------------------------------------- diagram */

export type DiagramCues = { kuru: number; cancel: number; pyth: number; seats: number; noSeat: number; result: number }

/**
 * Layout (1920x1080; face circle bottom right, captions at the bottom):
 *   stickman -> Raider -> RaidRouter -> Kuru order book (wall, on Monad)
 *                           ^ SeatGate (one Lil Star = one seat)
 *   RaidVault -> Pyth Entropy -> Settle  (seats split / rollover)
 */
export function Diagram({ c, icons }: { c: DiagramCues; icons: Record<string, string | undefined> }) {
  const frame = useCurrentFrame()
  const boxes: BoxSpec[] = [
    { id: 'router', x: 540, y: 200, w: 420, h: 120, title: 'RaidRouter', sub: 'buys at the cap price', fill: '#b9a7ff', icon: icons.router, at: c.kuru + 6 },
    { id: 'kuru', x: 1110, y: 175, w: 470, h: 170, title: 'Kuru order book', sub: 'sponsor wall, on Monad', fill: '#8fbcef', icon: icons.kuru, logo: 'logos/kuru.png', at: c.kuru + 14 },
    { id: 'gate', x: 540, y: 420, w: 420, h: 110, title: 'SeatGate', sub: 'one Lil Star = one seat', fill: '#ff8de0', icon: icons.gate, at: c.seats },
    { id: 'vault', x: 70, y: 620, w: 410, h: 120, title: 'RaidVault', sub: 'holds the USDC prize', fill: '#a3e3c1', icon: icons.vault, at: c.pyth },
    { id: 'pyth', x: 540, y: 620, w: 420, h: 120, title: 'Pyth Entropy', sub: 'draws the end block', fill: '#ffb84d', icon: icons.pyth, logo: 'logos/pyth.png', at: c.pyth + 10 },
    { id: 'settle', x: 1110, y: 620, w: 380, h: 120, title: 'Settle', sub: 'counted ≥ target?', fill: '#d8d0ff', icon: icons.settle, at: c.result },
  ]
  const A = {
    hit: { id: 'hit', from: [300, 262], to: [532, 260], label: 'hit (USDC)', at: c.kuru + 2 } as ArrowSpec,
    buy: { id: 'buy', from: [964, 232], to: [1104, 222], bend: -0.25, label: 'buy ≤ cap', at: c.kuru + 20 } as ArrowSpec,
    refund: { id: 'refund', from: [1104, 300], to: [964, 290], bend: -0.25, label: 'cancel rest + refund', at: c.cancel, color: '#c2255c', labelAt: [1040, 392] } as ArrowSpec,
    seat: { id: 'seat', from: [750, 418], to: [750, 326], label: 'seat?', at: c.seats + 8, labelAt: [800, 384] } as ArrowSpec,
    close: { id: 'close', from: [484, 680], to: [534, 680], at: c.pyth + 14 } as ArrowSpec,
    end: { id: 'end', from: [964, 680], to: [1104, 680], label: 'end block', at: c.result - 6 } as ArrowSpec,
    count: { id: 'count', from: [1320, 350], to: [1320, 614], label: 'hits ≤ end block', at: c.result, dashed: true, labelAt: [1440, 480] } as ArrowSpec,
  }
  const arrows = Object.values(A)
  // stickman: walks in at the start of the scene, then every tap launches a coin down the hit arrow
  const arrive = c.kuru + 22
  const walkIn = interpolate(frame, [0, arrive], [-120, 190], { ...clamp, easing: (x) => 1 - (1 - x) ** 2 })
  const walking = frame < arrive
  const won = frame >= c.result + 22
  const manPose: Pose = won ? 'cheer' : walking ? 'walk' : 'tap'
  const HIT_EVERY = 46
  const hitAt = arrive + 4
  const tk = frame >= hitAt ? (frame - hitAt) % HIT_EVERY : 99
  const press = tk < 7 ? interpolate(tk, [0, 2, 7], [0, 1, 0], clamp) : 0
  // the no-seat wallet: a bot stickman whose buy goes through but counts 0
  const noSeat = frame >= c.noSeat
  const bounce = noSeat ? spring({ frame: frame - c.noSeat, fps: 30, config: { damping: 8, stiffness: 160 } }) : 0
  return (
    <AbsoluteFill style={{ background: '#fffdf7' }}>
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(#e2deee 1.6px, transparent 1.8px)', backgroundSize: '28px 28px' }} />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <text x={70} y={118} fontFamily={HAND} fontSize={66} fill={INK}>
          How it works
        </text>
        <Underline frame={frame} />
        <MonadTag frame={frame} at={c.kuru + 24} />
        {arrows.map((a, i) => (
          <Arrow key={a.id} a={a} frame={frame} seed={i * 7 + 3} />
        ))}
        {boxes.map((b, i) => (
          <Box key={b.id} b={b} frame={frame} seed={i * 31 + 5} />
        ))}
        {/* the raider */}
        <Stickman x={walkIn} y={330} pose={manPose} t={frame} scale={1.25} hat="star" press={press} />
        {!walking && !won && <PhoneProp x={walkIn + 34} y={232} on={tk < 6} />}
        <text x={walkIn} y={402} textAnchor="middle" fontFamily={HAND} fontSize={28} fill={INK} opacity={interpolate(frame, [arrive - 6, arrive + 4], [0, 1], clamp)}>
          raider
        </text>
        {/* money moving: hits go in, leftovers come back */}
        <Coin a={A.hit} at={hitAt + 2} until={c.pyth} every={HIT_EVERY} />
        <Coin a={A.buy} at={hitAt + 30} until={c.pyth} every={HIT_EVERY} />
        <Coin a={A.refund} at={Math.max(c.cancel + 16, hitAt + 60)} until={c.pyth} every={HIT_EVERY * 2} color="#ffc9de" />
        {/* no Lil Star: the bot's buy works, counts 0 */}
        {noSeat && (
          <g opacity={Math.min(1, bounce * 1.5)}>
            <Stickman x={170} y={560} pose="shrug" t={frame} scale={1} hat="bot" color="#6b6b80" />
            <text x={226} y={470} fontFamily={HAND} fontSize={27} fill="#6b6b80">
              no Lil Star?
            </text>
            <text x={226} y={506} fontFamily={HAND} fontSize={27} fill="#6b6b80">
              buy works, counts 0
            </text>
            <path d="M222 520 q110 -8 260 2" stroke="#e03131" strokeWidth={4} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - interpolate(frame, [c.noSeat + 6, c.noSeat + 16], [0, 1], clamp)} />
          </g>
        )}
        {won && (
          <g opacity={interpolate(frame, [c.result + 22, c.result + 30], [0, 1], clamp)}>
            <text x={1110} y={800} fontFamily={HAND} fontSize={28} fill="#2b8a3e">
              ✓ target hit → seats split the prize
            </text>
            <text x={1110} y={840} fontFamily={HAND} fontSize={27} fill="#c2255c">
              ✗ missed → prize rolls to the next raid
            </text>
          </g>
        )}
      </svg>
      {/* a soft tap sound on every HIT the stickman makes */}
      {Array.from({ length: Math.max(0, Math.floor((c.pyth - hitAt) / HIT_EVERY)) }, (_, i) => (
        <Sequence key={i} from={hitAt + i * HIT_EVERY} durationInFrames={20} layout="none">
          <Html5Audio src={staticFile('audio/kit/hit.mp3')} volume={0.12} />
        </Sequence>
      ))}
      {/* pen sounds as each box and arrow draws itself, a snap for each partner logo sticker */}
      {boxes.map((b) => (
        <Sfx key={`b${b.id}`} at={b.at} kind="scribble" />
      ))}
      {arrows.map((a) => (
        <Sfx key={`a${a.id}`} at={a.at} kind="scribble" volume={0.12} />
      ))}
      {boxes.filter((b) => b.logo).map((b) => (
        <Sfx key={`l${b.id}`} at={b.at + 12} kind="boing" />
      ))}
      <Sfx at={c.kuru + 24} kind="boing" />
      <Sfx at={2} kind="slide-in" />
      <Sfx at={c.noSeat} kind="slide-in" />
      <Sfx at={c.result + 22} kind="sparkle" />
    </AbsoluteFill>
  )
}

function Underline({ frame }: { frame: number }) {
  const ps = useRough('underline', () => paths(gen.line(92, 138, 450, 132, { seed: 4, roughness: 2, stroke: '#fd6b10', strokeWidth: 5 })))
  const t = interpolate(frame, [4, 18], [0, 1], clamp)
  return (
    <>
      {ps.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke="#fd6b10" strokeWidth={p.w} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
      ))}
    </>
  )
}

/** "runs on Monad" tag next to the title, with the Monad mark. */
function MonadTag({ frame, at }: { frame: number; at: number }) {
  const ps = useRough('monadtag', () => paths(gen.rectangle(560, 58, 330, 74, { seed: 12, roughness: 1.5, stroke: INK, strokeWidth: 2.5, fill: '#e5dbff', fillStyle: 'hachure', hachureGap: 9 })))
  if (frame < at) return null
  const p = spring({ frame: frame - at, fps: 30, config: { damping: 10, stiffness: 200 } })
  return (
    <g style={{ transformOrigin: '725px 95px', transform: `scale(${p}) rotate(${-2 + (1 - p) * -10}deg)` }}>
      {ps.map((q, i) => (
        <path key={i} d={q.d} fill="none" stroke={q.stroke === 'none' ? '#b197fc' : q.stroke} strokeWidth={q.w} strokeLinecap="round" />
      ))}
      <image href={staticFile('logos/monad.png')} x={574} y={68} width={54} height={54} />
      <text x={640} y={106} fontFamily={HAND} fontSize={32} fill={INK}>
        runs on Monad
      </text>
    </g>
  )
}
