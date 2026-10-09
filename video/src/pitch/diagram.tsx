/**
 * "How it works" as a whiteboard sketch: Excalidraw-like wobbly boxes and arrows that draw
 * themselves as he talks. Every box and arrow is a real piece of the system (see docs/plan/DESIGN.md
 * and contracts/src): RaidRouter buys on Kuru at the cap and cancels the rest, SeatGate checks the
 * Lil Star, RaidVault holds the prize and asks Pyth Entropy for the end block, then settles.
 */
import { loadFont } from '@remotion/google-fonts/Kalam'
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { clamp } from '../ui'

const { fontFamily: HAND } = loadFont('normal', { weights: ['400', '700'], subsets: ['latin'] })

const INK = '#1e1a2e'

/** Deterministic jitter so the sketch looks hand-drawn but does not flicker between frames. */
function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
const j = (seed: number, amt = 3) => (rnd(seed) - 0.5) * 2 * amt

/** Two slightly different passes of a rectangle, like Excalidraw's "sloppiness: artist". */
function roughRect(x: number, y: number, w: number, h: number, seed: number) {
  const pass = (s: number) => {
    const p = [
      [x + j(s + 1), y + j(s + 2)],
      [x + w + j(s + 3), y + j(s + 4)],
      [x + w + j(s + 5), y + h + j(s + 6)],
      [x + j(s + 7), y + h + j(s + 8)],
    ]
    return `M${p[0]} Q${(p[0][0] + p[1][0]) / 2 + j(s + 9, 2)},${(p[0][1] + p[1][1]) / 2 + j(s + 10, 4)} ${p[1]} Q${(p[1][0] + p[2][0]) / 2 + j(s + 11, 4)},${(p[1][1] + p[2][1]) / 2 + j(s + 12, 2)} ${p[2]} Q${(p[2][0] + p[3][0]) / 2 + j(s + 13, 2)},${(p[2][1] + p[3][1]) / 2 + j(s + 14, 4)} ${p[3]} Q${(p[3][0] + p[0][0]) / 2 + j(s + 15, 4)},${(p[3][1] + p[0][1]) / 2 + j(s + 16, 2)} ${p[0][0] + j(s + 17, 6)},${p[0][1] + j(s + 18, 3)}`
  }
  return [pass(seed), pass(seed + 50)]
}

/** Hatched fill like Excalidraw's "hachure". */
function hachure(x: number, y: number, w: number, h: number, seed: number) {
  const lines: string[] = []
  const gap = 14
  for (let d = -h; d < w; d += gap) {
    const x0 = Math.max(x, x + d)
    const y0 = d < 0 ? y - d : y
    const len = Math.min(w - Math.max(0, d), h - Math.max(0, -d))
    if (len <= 4) continue
    lines.push(`M${x0 + j(seed + d, 1.5)},${y0 + j(seed + d + 1, 1.5)} l${len},${len}`)
  }
  return lines.join(' ')
}

type BoxSpec = { id: string; x: number; y: number; w: number; h: number; title: string; sub?: string; fill: string; icon?: string; at: number }
type ArrowSpec = { from: [number, number]; to: [number, number]; bend?: number; label?: string; at: number; dashed?: boolean; color?: string }

function Box({ b, frame, fps, seed }: { b: BoxSpec; frame: number; fps: number; seed: number }) {
  if (frame < b.at) return null
  const p = spring({ frame: frame - b.at, fps, config: { damping: 14, stiffness: 200 } })
  const draw = interpolate(frame, [b.at, b.at + 12], [0, 1], clamp)
  const [a, c] = roughRect(b.x, b.y, b.w, b.h, seed)
  return (
    <g style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h / 2}px`, transform: `scale(${0.85 + 0.15 * p})` }}>
      <clipPath id={`c${b.id}`}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} />
      </clipPath>
      <g clipPath={`url(#c${b.id})`} opacity={draw}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} opacity={0.35} />
        <path d={hachure(b.x, b.y, b.w, b.h, seed)} stroke={b.fill} strokeWidth={3} opacity={0.9} />
      </g>
      <path d={a} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <path d={c} fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <g opacity={interpolate(frame, [b.at + 6, b.at + 14], [0, 1], clamp)}>
        {b.icon && <image href={staticFile(b.icon)} x={b.x + 8} y={b.y + (b.h - 96) / 2} width={96} height={96} style={{ mixBlendMode: 'multiply' }} />}
        <text x={b.x + (b.icon ? 106 : b.w / 2)} y={b.y + (b.sub ? b.h / 2 - 4 : b.h / 2 + 12)} textAnchor={b.icon ? 'start' : 'middle'} fontFamily={HAND} fontWeight={700} fontSize={34} fill={INK}>
          {b.title}
        </text>
        {b.sub && (
          <text x={b.x + (b.icon ? 106 : b.w / 2)} y={b.y + b.h / 2 + 30} textAnchor={b.icon ? 'start' : 'middle'} fontFamily={HAND} fontSize={24} fill="#4a4373">
            {b.sub}
          </text>
        )}
      </g>
    </g>
  )
}

function Arrow({ a, frame, seed }: { a: ArrowSpec; frame: number; seed: number }) {
  if (frame < a.at) return null
  const draw = interpolate(frame, [a.at, a.at + 14], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 2 })
  const [x1, y1] = a.from
  const [x2, y2] = a.to
  const bend = a.bend ?? 0
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend * 0.002 * 100 + j(seed, 4)
  const my = (y1 + y2) / 2 + (x2 - x1) * bend * 0.002 * 100 + j(seed + 1, 4)
  const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
  // arrow head along the last tangent
  const ang = Math.atan2(y2 - my, x2 - mx)
  const hl = 20
  const h1 = [x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45)]
  const h2 = [x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45)]
  const col = a.color ?? INK
  // label sits at the curve's midpoint (t = 0.5 on a quadratic)
  const lx = 0.25 * x1 + 0.5 * mx + 0.25 * x2
  const ly = 0.25 * y1 + 0.5 * my + 0.25 * y2
  return (
    <g>
      <path d={d} fill="none" stroke={col} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={a.dashed ? undefined : 1} strokeDashoffset={a.dashed ? undefined : 1 - draw} style={a.dashed ? { strokeDasharray: '10 10', opacity: draw } : undefined} />
      {draw > 0.95 && <path d={`M${h1} L${x2},${y2} L${h2}`} fill="none" stroke={col} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />}
      {a.label && (
        <g opacity={interpolate(frame, [a.at + 8, a.at + 16], [0, 1], clamp)}>
          <rect x={lx - a.label.length * 6.6 - 10} y={ly - 22} width={a.label.length * 13.2 + 20} height={36} rx={8} fill="#fffdf7" />
          <text x={lx} y={ly + 5} textAnchor="middle" fontFamily={HAND} fontSize={25} fill={col}>
            {a.label}
          </text>
        </g>
      )}
    </g>
  )
}

/** A dot that rides along an arrow, to show the money/hit moving. */
function Packet({ from, to, at, len = 22, color = '#fd6b10' }: { from: [number, number]; to: [number, number]; at: number; len?: number; color?: string }) {
  const frame = useCurrentFrame()
  if (frame < at || frame > at + len + 4) return null
  const t = interpolate(frame, [at, at + len], [0, 1], { ...clamp, easing: (x) => x * x * (3 - 2 * x) })
  return <circle cx={from[0] + (to[0] - from[0]) * t} cy={from[1] + (to[1] - from[1]) * t} r={11} fill={color} stroke={INK} strokeWidth={3} />
}

export type DiagramCues = { kuru: number; cancel: number; pyth: number; seats: number; noSeat: number; result: number }

/**
 * Layout (1920x1080, the face circle sits bottom right, captions at the bottom):
 *   Raider + Lil Star  ->  SeatGate  ->  RaidRouter  ->  Kuru order book (wall)
 *   Sponsor -> RaidVault (prize) -> Pyth Entropy -> end block -> settle -> seats split / rollover
 */
export function Diagram({ c, icons }: { c: DiagramCues; icons: Record<string, string | undefined> }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const boxes: BoxSpec[] = [
    { id: 'raider', x: 90, y: 190, w: 330, h: 120, title: 'Raider', sub: 'taps HIT, pays USDC', fill: '#ffd27a', icon: icons.raider, at: c.kuru },
    { id: 'router', x: 560, y: 190, w: 360, h: 120, title: 'RaidRouter', sub: 'buy at the cap price', fill: '#b9a7ff', icon: icons.router, at: c.kuru + 8 },
    { id: 'kuru', x: 1080, y: 160, w: 420, h: 180, title: 'Kuru order book', sub: 'on Monad · sponsor wall', fill: '#8fbcef', icon: icons.kuru, at: c.kuru + 16 },
    { id: 'gate', x: 560, y: 400, w: 360, h: 110, title: 'SeatGate', sub: 'one Lil Star = one seat', fill: '#ff8de0', icon: icons.gate, at: c.seats },
    { id: 'vault', x: 90, y: 600, w: 360, h: 120, title: 'RaidVault', sub: 'holds the USDC prize', fill: '#a3e3c1', icon: icons.vault, at: c.pyth },
    { id: 'pyth', x: 560, y: 600, w: 360, h: 120, title: 'Pyth Entropy', sub: 'draws the end block', fill: '#ffb84d', icon: icons.pyth, at: c.pyth + 10 },
    { id: 'settle', x: 1080, y: 600, w: 330, h: 120, title: 'Settle', sub: 'counted ≥ target?', fill: '#d8d0ff', icon: icons.settle, at: c.result },
  ]
  const arrows: ArrowSpec[] = [
    { from: [420, 250], to: [556, 250], label: 'hit', at: c.kuru + 4 },
    { from: [920, 230], to: [1076, 220], bend: -6, label: 'buy ≤ cap', at: c.kuru + 20 },
    { from: [1076, 290], to: [920, 280], bend: -6, label: 'cancel rest + refund', at: c.cancel, color: '#aa3686' },
    { from: [740, 400], to: [740, 316], label: 'seat?', at: c.seats + 8 },
    { from: [450, 660], to: [556, 660], label: 'close', at: c.pyth + 14 },
    { from: [920, 660], to: [1076, 660], label: 'end block', at: c.result - 6 },
    { from: [1245, 345], to: [1245, 596], label: 'hits ≤ end block', at: c.result, dashed: true },
  ]
  const won = frame >= c.result + 22
  return (
    <AbsoluteFill style={{ background: '#fffdf7' }}>
      {/* faint whiteboard grid */}
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(#d9d4ea 1.6px, transparent 1.8px)', backgroundSize: '28px 28px' }} />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <text x={90} y={120} fontFamily={HAND} fontWeight={700} fontSize={64} fill={INK}>
          How it works
        </text>
        <path d="M92,138 q160,10 330,-2" stroke="#fd6b10" strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - interpolate(frame, [4, 18], [0, 1], clamp)} />
        {arrows.map((a, i) => (
          <Arrow key={i} a={a} frame={frame} seed={i * 7 + 3} />
        ))}
        {boxes.map((b, i) => (
          <Box key={b.id} b={b} frame={frame} fps={fps} seed={i * 31 + 5} />
        ))}
        <Packet from={[420, 250]} to={[556, 250]} at={c.kuru + 30} />
        <Packet from={[920, 230]} to={[1076, 220]} at={c.kuru + 52} />
        <Packet from={[1076, 290]} to={[920, 280]} at={c.cancel + 16} color="#e826b1" />
        {/* the wallet without a seat: crossed out */}
        {frame >= c.noSeat && (
          <g opacity={interpolate(frame, [c.noSeat, c.noSeat + 8], [0, 1], clamp)}>
            <text x={90} y={470} fontFamily={HAND} fontSize={30} fill="#4a4373">
              no Lil Star?
            </text>
            <text x={90} y={506} fontFamily={HAND} fontSize={30} fill="#4a4373">
              buy works, counts 0
            </text>
            <path d="M88,520 q130,-8 262,0" stroke="#e8264f" strokeWidth={4} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - interpolate(frame, [c.noSeat + 6, c.noSeat + 16], [0, 1], clamp)} />
          </g>
        )}
        {won && (
          <g opacity={interpolate(frame, [c.result + 22, c.result + 30], [0, 1], clamp)}>
            <text x={1080} y={790} fontFamily={HAND} fontWeight={700} fontSize={30} fill="#2f8a5c">
              ✓ hit target → seats split prize
            </text>
            <text x={1080} y={830} fontFamily={HAND} fontSize={28} fill="#aa3686">
              ✗ missed → prize rolls to next raid
            </text>
          </g>
        )}
      </svg>
      {/* icons that are not drawn into a box yet get the existing Lil Stars-world art as fallback */}
      <Img src={staticFile('art/sparkle.webp')} style={{ display: 'none' }} />
    </AbsoluteFill>
  )
}
