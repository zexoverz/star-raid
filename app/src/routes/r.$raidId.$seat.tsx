import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Panel } from '../components/game'
import { CrewRow, Guide } from '../components/mascots'
import { fmt } from '../lib/format'
import { useRaidStream } from '../lib/live'
import { phaseOf } from '../lib/phase'
import { play } from '../lib/sfx'
import { PlayerPill } from '../components/profile'

export const Route = createFileRoute('/r/$raidId/$seat')({ component: SharePage })

/** Public URL used in share links; the server renders the OG meta and the card for these paths. */
export const shareUrl = (raidId: string, seat: string, utm = true) =>
  `${location.origin}/r/${raidId}/${seat}${utm ? '?utm_source=x&utm_medium=share&utm_campaign=raid' + raidId : ''}`

export function ShareButtons({ raidId, seat, text }: { raidId: string; seat: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const link = shareUrl(raidId, seat)
  const card = `/og/${raidId}/${seat}.png`
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <a className="btn btn-primary px-6 py-3" href={intent} target="_blank" rel="noreferrer" onClick={() => play('click')}>
        𝕏 Post on X
      </a>
      <a className="btn btn-candy px-6 py-3" href={card} download={`star-raid-${raidId}-${seat}.png`} onClick={() => play('coin')}>
        ⬇ Save image
      </a>
      <button
        className="btn btn-ghost px-6 py-3"
        onClick={async () => {
          await navigator.clipboard.writeText(link)
          setCopied(true)
          play('click')
          setTimeout(() => setCopied(false), 1800)
        }}
      >
        {copied ? '✓ Copied' : '🔗 Copy link'}
      </button>
    </div>
  )
}

export function shareText(won: boolean | null, raidId: string, counted?: string) {
  if (won) return `We broke the wall in Star Raid #${raidId}! My Lil Star counted ${counted ?? ''} tUSDC. One Star, one seat.`
  if (won === false) return `The wall held in Star Raid #${raidId}. The prize rolls to the next raid. Who's in?`
  return `Raiding the wall in Star Raid #${raidId} with my Lil Star.`
}

function SharePage() {
  const { raidId, seat } = Route.useParams()
  const { view, loading } = useRaidStream(raidId)
  const [imgOk, setImgOk] = useState(true)
  const s = view?.seats.find((x) => x.tokenId === seat)
  const phase = view ? phaseOf(view) : null
  const live = phase === 'live' || phase === 'danger' || phase === 'upcoming'

  return (
    <main className="relative pb-10 pt-28">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src="/art/raid_bg.webp" alt="" className="h-full w-full object-cover opacity-25 blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-b from-grape-950/60 to-grape-950" />
      </div>
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h1 className="title-outline -rotate-1 text-4xl sm:text-6xl">{s ? `Lil Star #${seat}` : `Star Raid #${raidId}`}</h1>
        {s && <PlayerPill address={s.holder ?? s.player} size={28} className="mt-3 text-lg text-grape-200" />}
        <p className="mt-2 text-grape-300">
          {loading ? 'Loading the raid…' : view ? (view.won ? 'broke the wall in this raid' : view.won === false ? 'raided, and the wall held' : 'is raiding right now') : 'This raid could not be found.'}
        </p>

        <motion.div initial={{ y: 20, opacity: 0, rotate: -1 }} animate={{ y: 0, opacity: 1, rotate: 0 }} className="mx-auto mt-6 overflow-hidden rounded-3xl border-[4px] border-ember-400 shadow-[0_10px_0_#2d2250,0_30px_60px_rgba(0,0,0,0.5)]">
          {imgOk ? (
            <img src={`/og/${raidId}/${seat}.png`} alt="Share card" className="block w-full" onError={() => setImgOk(false)} />
          ) : (
            <Panel className="rounded-none">
              <CrewRow size="h-24" pose="cheer" />
              <p className="mt-3 text-grape-300">The card is rendered on the hosted site.</p>
            </Panel>
          )}
        </motion.div>

        {view && (
          <div className="mt-6 space-y-5">
            <ShareButtons raidId={raidId} seat={seat} text={shareText(view.won, raidId, s ? fmt(s.counted, view.terms.quoteDecimals) : undefined)} />
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Guide who="fox" pose={live ? 'attack' : 'think'} size="h-28">
                {live ? 'This raid is live right now. Grab a Star and jump in!' : 'Want in on the next one? Bring a Lil Star, take a seat, hit the wall.'}
              </Guide>
              <div className="flex flex-col gap-2">
                <Link to="/raid/$raidId" params={{ raidId }} className="btn btn-primary px-6 py-3">
                  {live ? '⚔ Join this raid' : '▶ See the raid'}
                </Link>
                <Link to="/" className="btn btn-ghost px-6 py-3">
                  Next raid
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
