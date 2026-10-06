import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Sprite, Twinkles } from '../components/game'
import { MASCOTS } from '../lib/stars'

export const Route = createFileRoute('/how')({ component: How })

const STEPS = [
  { icon: 'flag_sponsor', title: 'A sponsor posts a raid', body: 'They put a wall of their token on Kuru’s on-chain order book at a cap price, plus a prize in tUSDC and a target. The wall cannot be pulled while the raid runs.' },
  { icon: 'seat_ticket', title: 'Stars take their seats', body: 'One Lil Star is one seat per raid. A wallet without a seat can still buy, but its buys count for nothing. That is the whole bot defence.' },
  { icon: 'hit_spark', title: 'The party hits the wall', body: 'For about a minute, seats buy with tUSDC. Each buy only fills at or below the cap; cheaper asks fill first; any leftover is cancelled and refunded in the same transaction.' },
  { icon: 'orb', title: 'The end is drawn', body: 'After the window closes, Pyth Entropy draws the end block somewhere in the last quarter (the danger zone). Nobody can know it in advance, so there is no point sniping the last second.' },
  { icon: 'trophy', title: 'Victory or the wall holds', body: 'If the seats counted enough wall buys before the end block, the prize splits across the seats by what each counted (each seat is capped). If not, the prize rolls to the sponsor’s next raid.' },
  { icon: 'chest_open', title: 'Open your chest', body: 'Your tSTAR is held for you. Winners claim after a short hold to get it plus their prize share, or exit early and forfeit the share.' },
]

function How() {
  return (
    <main className="relative overflow-hidden pb-10 pt-28">
      <Twinkles count={24} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h1 className="title-outline -rotate-2 text-center text-6xl sm:text-7xl">How a raid works</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-grape-300">Six beats, about two minutes, all on chain.</p>
        <div className="mt-12 space-y-6">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, x: i % 2 ? 40 : -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} className={`panel flex items-center gap-5 p-5 ${i % 2 ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
              <div className="relative shrink-0">
                <Sprite name={s.icon} className="h-24 w-24 drop-shadow-[0_6px_0_#15122a]" />
                <span className="absolute -left-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-candy-500 font-display text-lg text-white shadow-[0_3px_0_#7a1f5f]">{i + 1}</span>
              </div>
              <div>
                <h2 className="font-display text-2xl text-white">{s.title}</h2>
                <p className="mt-1 text-grape-300">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center gap-6">
          <div className="flex items-end gap-2">
            {MASCOTS.map((m, i) => (
              <motion.img key={m.name} src={m.src} alt={m.name} className="h-28 sm:h-36" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }} />
            ))}
          </div>
          <Link to="/" className="btn btn-primary px-10 py-4 text-2xl">
            ⚔ To the lobby
          </Link>
        </div>
      </div>
    </main>
  )
}
