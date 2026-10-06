import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { GameBar, Panel, Sprite, StarAvatar, Twinkles } from '../components/game'
import { fmt, ratio, duration } from '../lib/format'
import { useHealth, useRaids } from '../lib/live'
import { PHASE_LABEL, blocksToSec, isActive, phaseOf, sortLobby, type Phase } from '../lib/phase'
import { CrewRow, Guide, Mascot } from '../components/mascots'
import { PREVIEW_GALLERY } from '../lib/stars'
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
  const rest = rows.filter((r) => r !== featured)
  const wins = rows.filter((r) => r.won).length

  return (
    <main>
      <Hero featured={featured} head={head} wins={wins} total={rows.length} />

      <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6">
        <HowStrip />
      </section>

      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="title-outline-sm -rotate-1 text-4xl">Raid board</h2>
          <span className="text-sm text-grape-300">{raids.isLoading ? 'Loading raids…' : `${rows.length} raids on record`}</span>
        </div>
        {raids.isError && <ErrorCard />}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((r, i) => (
            <motion.div key={r.raidId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <RaidCard raid={r} head={head} />
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <Marquee />
      </section>
    </main>
  )
}

function Hero({ featured, head, wins, total }: { featured?: LobbyRaid; head?: bigint; wins: number; total: number }) {
  const live = featured ? isActive(phaseOf(featured, head)) : false
  return (
    <section className="relative isolate overflow-hidden pb-24 pt-24">
      {/* The Lil Stars street, from mint.lilstars.xyz */}
      <img src="/art/lilstars/street_sky.webp" alt="" className="absolute inset-0 -z-30 h-full w-full object-cover" />
      <img src="/art/lilstars/street_city.webp" alt="" className="absolute inset-x-0 bottom-0 -z-20 h-[78%] w-full object-cover object-bottom" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-grape-700/50 via-transparent to-grape-950" />
      <Twinkles count={10} />
      <div className="mx-auto grid max-w-7xl items-end gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative pt-6">
          <motion.img src="/art/lilstars/graffiti_logo.webp" alt="Lil Stars" className="-mb-2 h-24 w-auto -rotate-6 drop-shadow-[0_4px_0_#2d2250] sm:h-28" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} />
          <motion.h1 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }} className="title-outline -rotate-2 text-6xl leading-[0.95] sm:text-7xl lg:text-8xl">
            Star <span className="text-ember-400">Raid</span>
          </motion.h1>
          <div className="mt-4 max-w-md">
            <Guide who="fox" size="h-32 sm:h-40">
              A sponsor puts up a wall. We Stars hit it together for about a minute. The end is drawn at random, so hit early. Break it and we split the prize!
            </Guide>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {featured && (
              <Link to="/raid/$raidId" params={{ raidId: featured.raidId }} className="btn btn-primary px-8 py-4 text-xl">
                {live ? '⚔ Join the raid' : '▶ Watch the last raid'}
              </Link>
            )}
            <Link to="/how" className="btn btn-ghost px-6 py-4">
              How it works
            </Link>
          </div>
          <div className="mt-6 flex gap-3 text-sm">
            <div className="glass rounded-2xl px-4 py-2">
              <div className="font-display text-3xl text-ember-400">{wins}</div>
              <div className="text-cream-100">walls broken</div>
            </div>
            <div className="glass rounded-2xl px-4 py-2">
              <div className="font-display text-3xl text-white">{total}</div>
              <div className="text-cream-100">raids posted</div>
            </div>
          </div>
        </div>

        <div className="relative">
          {featured ? <FeaturedStage raid={featured} head={head} /> : <Panel className="h-80 animate-pulse">{null}</Panel>}
          <div className="pointer-events-none absolute -bottom-24 -left-28 hidden 2xl:block">
            <Mascot who="bear" className="h-40" />
          </div>
          <div className="pointer-events-none absolute -bottom-24 -right-24 hidden 2xl:block">
            <Mascot who="bunny" className="h-36" />
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
          <Mascot who="chog" className="absolute bottom-0 left-0 z-10 h-28 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,0.45)]" />
          <BossImg name={boss} className="h-52 w-52 object-contain drop-shadow-[0_14px_0_rgba(21,18,42,0.6)] transition-transform group-hover:scale-105 group-hover:animate-wiggle" />
          <Mascot who="fox" className="absolute bottom-0 right-0 z-10 h-32 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,0.45)]" />
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
                {fmt(raid.counted, t.quoteDecimals)} / {fmt(t.target, t.quoteDecimals)} tUSDC
              </span>
            </div>
            <GameBar value={progress} height={24} marker={1} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            <span className="chip bg-ember-500/20 text-ember-300">🏆 Prize {fmt(t.bounty, t.quoteDecimals)} tUSDC</span>
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

function RaidCard({ raid, head }: { raid: LobbyRaid; head?: bigint }) {
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
    { who: 'chog' as const, title: 'Bring a Star', body: 'One Lil Star = one seat per raid. Wallets without a seat can buy, but count for nothing.' },
    { who: 'fox' as const, title: 'Hit the wall', body: 'Arm one-tap once, then every hit is a single tap. Buys never fill above the cap.' },
    { who: 'bunny' as const, title: 'The end is drawn', body: 'Pyth Entropy picks the end block after the window. Hits after it do not count.' },
    { who: 'bear' as const, title: 'Split the prize', body: 'Beat the target and seats share the prize by what they counted, after a short hold.' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <motion.div key={s.title} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="dashed-card relative overflow-hidden bg-grape-900/85 p-4 pt-3 backdrop-blur" style={{ ['--card-color' as string]: ['#A3E3C1', '#F7C873', '#F7B2D9', '#B6D6F7'][i] }}>
          <div className="flex items-end gap-3">
            <Mascot who={s.who} className="h-24 w-auto shrink-0 drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)]" />
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
      <CrewRow size="h-24" />
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

function ErrorCard() {
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
