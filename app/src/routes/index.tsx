import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { GameBar, Panel, Sprite, StarAvatar, Twinkles } from '../components/game'
import { fmt, ratio, duration } from '../lib/format'
import { useHealth, useRaids } from '../lib/live'
import { PHASE_LABEL, blocksToSec, isActive, phaseOf, sortLobby, type Phase } from '../lib/phase'
import { CrewRow, Guide, Mascot } from '../components/mascots'
import { NextRaidCountdown } from '../components/countdown'
import { EmptyState } from '../components/empty'
import { PREVIEW_GALLERY } from '../lib/stars'
import { TokenIcon } from '../components/token'
import type { LobbyRaid } from '../lib/types'

export const Route = createFileRoute('/')({ component: Lobby })

export function useHead(): bigint | undefined {
  const h = useHealth()
  return h.data?.proposed ? BigInt(h.data.proposed) : undefined
}

function Lobby() {
  const raids = useRaids()
  const head = useHead()
  const rows = raids.data ? sortLobby(raids.data, head) : []
  const featured = rows.find((r) => isActive(phaseOf(r, head))) ?? rows[0]
  const recent = rows.filter((r) => r !== featured).slice(0, 3)
  const wins = rows.filter((r) => r.won).length
  const live = featured ? isActive(phaseOf(featured, head)) : false

  return (
    <main>
      <Hero featured={featured} head={head} />

      <BrickBackdrop className="pt-10">
        <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.25fr_1fr]">
          {featured ? <FeaturedStage raid={featured} head={head} /> : <Panel className="h-80 animate-pulse">{null}</Panel>}
          <div className="flex flex-col gap-4">
            <Guide who="fox" pose={live ? 'attack' : 'think'} size="h-28">
              {live ? 'A raid is live right now! Grab your Star and jump in.' : featured ? `The last raid ${featured.won ? 'broke the wall!' : featured.status === 'Aborted' ? 'was called off.' : 'is over.'} The next one is coming. Warm up in a practice raid!` : 'Loading the raid board…'}
            </Guide>
            <div className="grid grid-cols-2 gap-3">
              <Stat value={wins} label="walls broken" tone="text-ember-400" />
              <Stat value={rows.length} label="raids posted" tone="text-white" />
            </div>
            <div className="panel flex-1 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-lg text-white">Recent raids</div>
                <Link to="/raids" className="text-sm font-bold text-candy-300 hover:text-candy-200">
                  Raid board →
                </Link>
              </div>
              {raids.isError && <ErrorCard />}
              <ul className="space-y-2">
                {recent.map((r) => (
                  <li key={r.raidId}>
                    <RaidRow raid={r} head={head} />
                  </li>
                ))}
                {!raids.isLoading && recent.length === 0 && (
                  <li>
                    <EmptyState scene="no-recent" title="No earlier raids yet" size="sm">
                      Past raids land here once they settle.
                    </EmptyState>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto mt-12 max-w-7xl px-4 pb-4 sm:px-6">
          <HowStrip />
        </section>
      </BrickBackdrop>

      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <Marquee />
      </section>
    </main>
  )
}

/** Lil Stars brick wall behind the lobby content, faded into the page at both ends. */
export function BrickBackdrop({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative isolate ${className}`}>
      <div className="absolute inset-0 -z-10 bg-[url('/art/brick_wall.svg')] bg-[length:240px_160px] bg-repeat opacity-90" />
      {/* warm glow from below, like the hero's street lamps, then fade into the page at both ends */}
      <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 50% 110%, rgba(255,140,66,0.18), transparent 60%)' }} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-grape-950 via-grape-950/30 to-grape-950" />
      {children}
    </div>
  )
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="panel px-4 py-3 text-center">
      <div className={`font-display text-4xl ${tone}`}>{value}</div>
      <div className="text-xs font-bold uppercase tracking-widest text-grape-300">{label}</div>
    </div>
  )
}

/** Compact raid line for the lobby's recent list. */
export function RaidRow({ raid, head }: { raid: LobbyRaid; head?: bigint }) {
  const phase = phaseOf(raid, head)
  const t = raid.terms
  const art = phase === 'victory' ? 'trophy' : phase === 'defeat' ? 'defeat' : phase === 'called-off' ? 'lock' : phase === 'drawing' ? 'orb' : 'wall_boss'
  return (
    <Link to="/raid/$raidId" params={{ raidId: raid.raidId }} className="group flex items-center gap-3 rounded-2xl bg-grape-950/60 px-3 py-2 transition hover:bg-grape-800/70">
      <BossImg name={art} className="h-10 w-10 shrink-0 object-contain transition-transform group-hover:rotate-6" />
      <div className="min-w-0 flex-1">
        <div className="font-display text-white">Raid #{raid.raidId}</div>
        <div className="truncate text-xs text-grape-300">
          {fmt(raid.counted, t.quoteDecimals)} / {fmt(t.target, t.quoteDecimals)} counted · {raid.seatCount} seats
        </div>
      </div>
      <PhaseChip phase={phase} />
    </Link>
  )
}

function Hero({ featured, head }: { featured?: LobbyRaid; head?: bigint }) {
  const live = featured ? isActive(phaseOf(featured, head)) : false
  return (
    <section className="relative isolate">
      {/* One coherent scene: the Lil Stars street on raid night, the crew facing the wall. */}
      <div className="relative h-[min(92vh,820px)] min-h-[560px] overflow-hidden">
        <motion.img
          src="/art/hero_scene.webp"
          alt="Foxstar, Chogstar, Bunnystar and Bearstar facing the sponsor's wall on a Lil Stars street at sunset"
          className="absolute inset-0 h-full w-full object-cover object-[30%_60%]"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-grape-950/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-grape-950 via-grape-950/70 to-transparent" />
        <Twinkles count={8} />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-between px-4 pb-10 pt-24 sm:px-6">
          <div className="flex flex-col items-center text-center lg:items-end lg:text-right">
            <motion.img src="/art/lilstars/graffiti_logo.webp" alt="Lil Stars" className="-mb-3 h-20 w-auto rotate-6 drop-shadow-[0_4px_0_#2d2250] sm:h-24" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }} />
            <motion.h1 initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.4 }} className="title-outline -rotate-2 text-7xl leading-[0.9] sm:text-8xl lg:text-9xl">
              Star <span className="text-ember-400">Raid</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="glass mt-4 max-w-md rounded-3xl px-5 py-3 text-base font-semibold text-white sm:text-lg">
              A sponsor puts up a wall. The Stars hit it together for about a minute. The end is drawn at random, so hit early. Break it and the seats split the prize.
            </motion.p>
            <div className="mt-3">
              <NextRaidCountdown />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
            {featured && (
              <Link to="/raid/$raidId" params={{ raidId: featured.raidId }} className="btn btn-primary px-8 py-4 text-xl">
                {live ? '⚔ Join the raid' : '▶ Watch the last raid'}
              </Link>
            )}
            {!live && (
              <Link to="/practice" className="btn btn-candy px-6 py-4 text-lg">
                ⚡ Try one-tap
              </Link>
            )}
            <Link to="/how" className="btn btn-ghost px-6 py-4">
              How it works
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturedStage({ raid, head }: { raid: LobbyRaid; head?: bigint }) {
  const phase = phaseOf(raid, head)
  const t = raid.terms
  const progress = ratio(raid.counted, t.target)
  const wallLeft = 1 - ratio(raid.wallSold, t.wallSize)
  const boss = phase === 'victory' ? 'wall_boss_ko' : progress > 0.5 ? 'wall_boss_hurt' : 'wall_boss'
  return (
    <Link to="/raid/$raidId" params={{ raidId: raid.raidId }} className="group block">
      <motion.div whileHover={{ y: -4 }} className="panel relative overflow-hidden p-6">
        <div className="absolute inset-0 -z-0 opacity-40" style={{ background: 'radial-gradient(circle at 50% 30%, #e826b1 0%, transparent 60%)' }} />
        <div className="relative flex items-center justify-between">
          <span className="font-display text-xl text-white">Raid #{raid.raidId}</span>
          <PhaseChip phase={phase} />
        </div>
        <div className="relative my-2 flex items-end justify-center">
          <Mascot who="chog" pose="attack" className="absolute bottom-0 left-0 z-10 h-32 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,0.45)]" />
          <BossImg name={boss} className="h-52 w-52 object-contain drop-shadow-[0_14px_0_rgba(21,18,42,0.6)] transition-transform group-hover:scale-105 group-hover:animate-wiggle" />
          <div className="absolute bottom-0 right-0 z-10" style={{ transform: 'scaleX(-1)' }}>
            <Mascot who="fox" pose="attack" className="h-32 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
        <div className="relative space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-widest text-grape-300">
              <span>Wall HP</span>
              <span>{Math.round(wallLeft * 100)}%</span>
            </div>
            <GameBar value={wallLeft} tone="boss" height={24} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-widest text-grape-300">
              <span>Counted toward target</span>
              <span>
                <TokenIcon token="usdc" size={12} /> {fmt(raid.counted, t.quoteDecimals)} / {fmt(t.target, t.quoteDecimals)}
              </span>
            </div>
            <GameBar value={progress} height={24} marker={1} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            <span className="chip bg-ember-500/20 text-ember-300">🏆 Prize <TokenIcon token="usdc" size={14} /> {fmt(t.bounty, t.quoteDecimals)}</span>
            <span className="chip bg-grape-600/50 text-grape-100">⭐ {raid.seatCount} seats</span>
            <span className="chip bg-grape-600/50 text-grape-100">⏳ hold {duration(t.hold)}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export function BossImg({ name, className }: { name: string; className?: string }) {
  return <img src={`/art/${name}.webp`} onError={(e) => ((e.target as HTMLImageElement).src = '/art/wall_boss.webp')} alt="The sponsor's wall" className={className} draggable={false} />
}

const PHASE_STYLE: Record<Phase, string> = {
  upcoming: 'bg-sky text-grape-900',
  live: 'bg-ember-500 text-white shadow-[0_0_12px_#ff8c42]',
  danger: 'bg-candy-500 text-white shadow-[0_0_12px_#e826b1] animate-pulse',
  drawing: 'bg-grape-300 text-grape-900 animate-pulse',
  revealed: 'bg-grape-300 text-grape-900',
  victory: 'bg-gold text-grape-900',
  defeat: 'bg-grape-700 text-grape-100',
  'called-off': 'bg-grape-800 text-grape-300',
}

export function PhaseChip({ phase }: { phase: Phase }) {
  return (
    <span className={`chip ${PHASE_STYLE[phase]}`}>
      {phase === 'live' || phase === 'danger' ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      {PHASE_LABEL[phase]}
    </span>
  )
}

export function RaidCard({ raid, head }: { raid: LobbyRaid; head?: bigint }) {
  const phase = phaseOf(raid, head)
  const t = raid.terms
  const progress = ratio(raid.counted, t.target)
  const art = phase === 'victory' ? 'trophy' : phase === 'defeat' ? 'defeat' : phase === 'called-off' ? 'lock' : phase === 'drawing' ? 'orb' : 'wall_boss'
  const colors: Record<Phase, string> = { upcoming: '#B6D6F7', live: '#F7C873', danger: '#F7B2D9', drawing: '#B6D6F7', revealed: '#B6D6F7', victory: '#F7C873', defeat: '#A3E3C1', 'called-off': '#7a6eb2' }
  const windowBlocks = BigInt(t.w1) - BigInt(t.w0) + 1n
  return (
    <Link to="/raid/$raidId" params={{ raidId: raid.raidId }} className="group block h-full">
      <div className="dashed-card relative h-full overflow-hidden bg-grape-900/70 p-5 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-[1.01]" style={{ ['--card-color' as string]: colors[phase] }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-2xl text-white">Raid #{raid.raidId}</div>
            <div className="mt-1">
              <PhaseChip phase={phase} />
            </div>
          </div>
          <BossImg name={art} className="h-20 w-20 object-contain drop-shadow-[0_4px_0_#15122a] transition-transform group-hover:rotate-6" />
        </div>
        <div className="mt-4">
          <GameBar value={progress} tone={phase === 'victory' ? 'mint' : 'ember'} height={20} marker={1} />
          <div className="mt-1.5 flex justify-between text-xs text-grape-300">
            <span>
              {fmt(raid.counted, t.quoteDecimals)} / {fmt(t.target, t.quoteDecimals)} counted
            </span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Mini label="Prize" value={`${fmt(t.bounty, t.quoteDecimals)}`} unit="tUSDC" />
          <Mini label="Seats" value={String(raid.seatCount)} unit={`${raid.buyCount} hits`} />
          <Mini label="Window" value={`~${duration(blocksToSec(windowBlocks))}`} unit={`${windowBlocks} blocks`} />
        </div>
        {phase === 'called-off' && <p className="mt-3 text-xs text-grape-300">Did not open. Every deposit went back in full.</p>}
      </div>
    </Link>
  )
}

function Mini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-grape-950/60 px-2 py-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-grape-300">{label}</div>
      <div className="font-display text-lg text-white">{value}</div>
      <div className="text-[10px] text-grape-300">{unit}</div>
    </div>
  )
}

function HowStrip() {
  const steps = [
    { who: 'chog' as const, pose: 'wait' as const, title: 'Bring a Star', body: 'One Lil Star = one seat per raid. Wallets without a seat can buy, but count for nothing.' },
    { who: 'fox' as const, pose: 'attack' as const, title: 'Hit the wall', body: 'Set up one-tap once, then every hit in every raid is a single tap. Buys never fill above the cap.' },
    { who: 'bunny' as const, pose: 'watch' as const, title: 'The end is drawn', body: 'Pyth Entropy picks the end block after the window. Hits after it do not count.' },
    { who: 'bear' as const, pose: 'cheer' as const, title: 'Split the prize', body: 'Beat the target and seats share the prize by what they counted, after a short hold.' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <motion.div key={s.title} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }} className="dashed-card relative overflow-hidden bg-grape-900/85 p-4 pt-3 backdrop-blur" style={{ ['--card-color' as string]: ['#A3E3C1', '#F7C873', '#F7B2D9', '#B6D6F7'][i] }}>
          <div className="flex items-end gap-3">
            <Mascot who={s.who} pose={s.pose} className="h-24 w-auto shrink-0 drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)]" />
            <div className="pb-1">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-candy-500 font-display text-sm text-white shadow-[0_2px_0_#7a1f5f]">{i + 1}</span>
              <div className="mt-1 font-display text-lg leading-tight text-white">{s.title}</div>
            </div>
          </div>
          <p className="mt-2 text-sm text-grape-300">{s.body}</p>
        </motion.div>
      ))}
    </div>
  )
}

function Marquee() {
  const ids = [...PREVIEW_GALLERY, ...PREVIEW_GALLERY]
  return (
    <div className="text-center">
      <CrewRow size="h-28" pose="cheer" />
      <h2 className="title-outline-sm mt-2 text-3xl">The Stars Crew</h2>
      <p className="mt-1 text-sm text-grape-300">Every seat is a Lil Star. Art by the Lil Stars team.</p>
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <motion.div className="flex w-max gap-4" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 60, ease: 'linear', repeat: Infinity }}>
          {ids.map((id, i) => (
            <img key={i} src={`/stars/${id}.webp`} alt="" className="h-32 w-32 rounded-2xl object-cover shadow-[0_4px_0_#2d2250]" loading="lazy" />
          ))}
        </motion.div>
      </div>
    </div>
  )
}

export function ErrorCard() {
  return (
    <Panel className="mb-6 flex items-center gap-4">
      <Sprite name="defeat" className="h-16 w-16" />
      <div>
        <div className="font-display text-xl">The live feed is not answering</div>
        <p className="text-sm text-grape-300">Retrying every few seconds. Nothing on chain is affected.</p>
      </div>
    </Panel>
  )
}

export { StarAvatar }
