import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../components/empty'
import { TxSteps } from '../components/join'
import { Guide } from '../components/mascots'
import { TokenIcon } from '../components/token'
import { WalletButton } from '../components/wallet'
import { fmt, duration } from '../lib/format'
import { useRaids } from '../lib/live'
import { isActive, phaseOf } from '../lib/phase'
import { buildTerms, DEFAULT_FORM, RULES, type Form, usePostRaid, useSponsorState } from '../lib/sponsor'
import { BossImg, BrickBackdrop, PhaseChip, RaidRow, useHead } from './index'

export const Route = createFileRoute('/sponsor')({ component: SponsorConsole })

/** Sponsor console: post a raid (wall + prize), see what you lock and get back, track your raids. */
function SponsorConsole() {
  const s = useSponsorState()
  const raids = useRaids()
  const head = useHead()
  const { post, steps, busy, posted } = usePostRaid()
  const [f, setF] = useState<Form>(DEFAULT_FORM)
  const [confirm, setConfirm] = useState(false)
  const b = useMemo(() => buildTerms(f), [f])
  const set = (k: keyof Form) => (v: string | number) => setF((x) => ({ ...x, [k]: v }))

  const rows = raids.data ?? []
  // Like the keeper: one raid on the book at a time, so a new wall never sits behind another one.
  const busyRaid = rows.find((r) => isActive(phaseOf(r, head)))
  const mine = s.address ? rows.filter((r) => r.terms.sponsor.toLowerCase() === s.address!.toLowerCase()) : []
  const prizeFromCredit = b.bounty < s.rollover ? b.bounty : s.rollover

  return (
    <main className="flex min-h-dvh flex-col pt-28">
      <BrickBackdrop className="flex-1 pb-16 pt-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="title-outline -rotate-1 text-5xl sm:text-6xl">Sponsor a raid</h1>
              <p className="mt-2 max-w-xl text-grape-300">Put up a wall of your token at a fixed price and a prize. Verified Lil Stars buy it out together in about a minute. Only buys from your wall count.</p>
            </div>
            <Guide who="bear" pose="cheer" size="h-24">
              You set the price. The crew does the rest!
            </Guide>
          </div>

          <HowItWorks />

          {!s.address ? (
            <div className="mt-8">
              <EmptyState scene="no-raids" title="Connect the sponsor wallet" size="lg" action={<WalletButton big />}>
                The wallet that posts is the sponsor: it gets the unsold wall and the tUSDC raised back, and it cannot raid its own wall.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <div className="panel p-6">
                <div className="font-display text-2xl text-white">Raid terms</div>
                <p className="mb-4 text-xs text-grape-300">Testnet: tSTAR on Kuru's tSTAR/tUSDC book. Missing test tokens are minted for you when you post.</p>

                <Field label="Wall" hint="tSTAR you put up for sale" icon="star" value={f.wallTokens} onChange={set('wallTokens')} />
                <Field label="Cap price" hint="tUSDC per tSTAR, fixed for the raid" icon="usdc" value={f.capPrice} onChange={set('capPrice')} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prize" hint="tUSDC split among seats on a win" icon="usdc" value={f.prize} onChange={set('prize')} />
                  <Field label="Target" hint="tUSDC of wall buys to win (≥10× prize)" icon="usdc" value={f.target} onChange={set('target')} />
                </div>
                <Field label="Seat cap" hint="max tUSDC one seat can count" icon="usdc" value={f.seatCap} onChange={set('seatCap')} />

                <div className="mt-2 grid grid-cols-3 gap-3">
                  <Slider label="Starts in" value={f.startInSec} min={15} max={600} step={5} fmt={(v) => duration(v)} onChange={set('startInSec')} />
                  <Slider label="Window" value={f.lengthSec} min={Number(RULES.MIN_WINDOW) * RULES.BLOCK_SEC} max={Number(RULES.MAX_WINDOW) * RULES.BLOCK_SEC} step={4} fmt={(v) => duration(v)} onChange={set('lengthSec')} />
                  <Slider label="Prize hold" value={f.holdSec} min={0} max={3600} step={30} fmt={(v) => (v ? duration(v) : 'none')} onChange={set('holdSec')} />
                </div>

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.14em] text-grape-300">
                  Affiliates <span className="normal-case tracking-normal">· optional, these wallets cannot raid (you never can)</span>
                </label>
                <textarea value={f.affiliates} onChange={(e) => set('affiliates')(e.target.value)} rows={2} placeholder="0x… one per line" className="mt-1 w-full rounded-2xl bg-grape-950/70 px-3 py-2 font-mono text-xs text-white outline-none ring-2 ring-transparent focus:ring-ember-400" />

                {b.errors.length > 0 && (
                  <ul className="mt-4 space-y-1 rounded-2xl bg-candy-600/15 p-3 text-sm text-candy-300">
                    {b.errors.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <Preview b={b} f={f} />
                <div className="panel p-5">
                  <div className="font-display text-lg text-white">You lock now</div>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-grape-300"><TokenIcon token="star" size={16} /> Wall</span>
                      <b className="text-white">{fmt(b.wallWei > 0n ? b.wallWei : 0n, 18)} tSTAR</b>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-grape-300"><TokenIcon token="usdc" size={16} /> Prize</span>
                      <b className="text-white">
                        {fmt(b.bounty > 0n ? b.bounty : 0n, 6)} tUSDC{prizeFromCredit > 0n ? ` (${fmt(prizeFromCredit, 6)} from credit)` : ''}
                      </b>
                    </li>
                  </ul>
                  <div className="mt-3 font-display text-lg text-white">You get back after the raid</div>
                  <ul className="mt-1 space-y-1 text-sm text-grape-300">
                    <li>• tUSDC paid for every tSTAR the crew bought (up to <b className="text-white">{fmt(b.wallValue, 6)}</b> if the wall sells out)</li>
                    <li>• any unsold tSTAR from the wall</li>
                    <li>• if the target is missed, the prize stays with the vault as <b className="text-white">credit for your next raid</b> (it can't be withdrawn)</li>
                  </ul>
                  <p className="mt-3 text-xs text-grape-300">
                    Your credit now: <b className="text-white">{fmt(s.rollover, 6)} tUSDC</b> · wallet: {fmt(s.star ?? 0n, 18)} tSTAR, {fmt(s.usdc ?? 0n, 6)} tUSDC
                  </p>

                  {busyRaid && (
                    <p className="mt-3 rounded-xl bg-ember-500/15 p-2 text-xs text-ember-300">
                      Raid #{busyRaid.raidId} is on the book right now. Post after it settles so your wall isn't stuck behind it.
                    </p>
                  )}
                  <button className="btn btn-primary mt-4 w-full py-3 text-lg" disabled={!b.ok || busy || !!busyRaid} onClick={() => setConfirm(true)}>
                    🚩 Post this raid
                  </button>
                  <div className="mt-3">
                    <TxSteps steps={steps} error={null} />
                  </div>
                  {posted && (
                    <Link to="/raid/$raidId" params={{ raidId: posted }} className="btn btn-candy mt-2 w-full py-2.5">
                      Watch raid #{posted} →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {s.address && (
            <div className="panel mt-8 p-5">
              <div className="mb-3 font-display text-xl text-white">Your raids</div>
              {mine.length === 0 ? (
                <EmptyState scene="no-raids" title="You haven't sponsored a raid yet" size="sm">
                  Post one above. It shows up here and on the raid board.
                </EmptyState>
              ) : (
                <ul className="space-y-2">
                  {mine.map((r) => (
                    <li key={r.raidId}>
                      <RaidRow raid={r} head={head} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </BrickBackdrop>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-50 grid place-items-end bg-grape-950/80 p-3 backdrop-blur-sm sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(false)}>
            <motion.div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-cream-100 p-6 text-grape-900 shadow-2xl" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-extrabold">Before you post</h3>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                <li>The vault takes {fmt(b.wallWei, 18)} tSTAR and {fmt(b.bounty - prizeFromCredit, 6)} tUSDC from this wallet now.</li>
                <li>At the start, the keeper puts the whole wall on Kuru's order book at {f.capPrice} tUSDC per tSTAR. Nobody, including you, can pull it until the raid ends. Kuru's admin can cancel orders on the book.</li>
                <li>After the window, Pyth Entropy draws the end block. Only seat buys from your wall up to that block count toward the {fmt(b.target, 6)} tUSDC target.</li>
                <li>At settle you get back the tUSDC raised and any unsold tSTAR. On a win the prize is split among the seats. On a loss it becomes credit for your next raid and cannot be withdrawn.</li>
                <li>You and your listed affiliates cannot raid this wall.</li>
                <li>Testnet, test tokens. Nothing here is a price, return or investment advice.</li>
              </ul>
              <div className="mt-6 flex gap-3">
                <button className="flex-1 rounded-full border-2 border-grape-600 py-3 font-bold" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-full bg-grape-700 py-3 font-bold text-white"
                  onClick={() => {
                    setConfirm(false)
                    void post(b, f, { star: s.star ?? 0n, usdc: s.usdc ?? 0n, rollover: s.rollover }).then(() => s.refetch())
                  }}
                >
                  I understand, post
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

function HowItWorks() {
  const steps = [
    { icon: 'flag_sponsor', t: 'You post', d: 'Wall of tSTAR + a tUSDC prize go into the vault.' },
    { icon: 'wall_boss', t: 'Wall goes up', d: 'At the start, your wall is placed on Kuru at your cap price.' },
    { icon: 'hit_spark', t: 'The crew raids', d: 'Seated Stars buy from your wall for about a minute.' },
    { icon: 'dice_block', t: 'End is drawn', d: 'Pyth Entropy picks the end block after the window.' },
    { icon: 'chest_open', t: 'Settle', d: 'You get the tUSDC raised + unsold tSTAR. Win: seats split the prize.' },
  ]
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-5">
      {steps.map((x, i) => (
        <div key={x.t} className="dashed-card flex items-center gap-2 bg-grape-900/70 p-3 sm:flex-col sm:text-center" style={{ ['--card-color' as string]: ['#B6D6F7', '#F7C873', '#F7B2D9', '#A3E3C1', '#FFB84D'][i] }}>
          <img src={`/art/${x.icon}.webp`} alt="" className="h-10 w-10 shrink-0 object-contain" />
          <div>
            <div className="font-display text-sm text-white">
              {i + 1}. {x.t}
            </div>
            <div className="text-[11px] text-grape-300">{x.d}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Field({ label, hint, icon, value, onChange }: { label: string; hint: string; icon: 'usdc' | 'star'; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mb-3 block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-grape-300">
        {label} <span className="normal-case tracking-normal">· {hint}</span>
      </span>
      <span className="mt-1 flex items-center gap-2 rounded-2xl bg-grape-950/70 px-3 py-2 ring-2 ring-transparent focus-within:ring-ember-400">
        <TokenIcon token={icon} size={22} />
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))} className="min-w-0 flex-1 bg-transparent font-display text-xl text-white outline-none" />
      </span>
    </label>
  )
}

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="block rounded-2xl bg-grape-950/50 p-2.5">
      <span className="flex justify-between text-[11px] text-grape-300">
        <b className="uppercase tracking-widest">{label}</b>
        <span className="font-bold text-white">{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#FF8C42]" />
    </label>
  )
}

/** What players will see in the lobby, from the form as you type. */
function Preview({ b, f }: { b: ReturnType<typeof buildTerms>; f: Form }) {
  const pct = b.wallValue > 0n && b.target > 0n ? Math.min(100, Number((b.target * 100n) / b.wallValue)) : 0
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 50% 30%, #e826b1 0%, transparent 60%)' }} />
      <div className="relative flex items-center justify-between">
        <span className="font-display text-lg text-white">Preview</span>
        <PhaseChip phase="upcoming" />
      </div>
      <div className="relative my-2 flex justify-center">
        <BossImg name="wall_boss" className="h-32 w-32 object-contain" />
      </div>
      <div className="relative flex flex-wrap gap-2 text-sm">
        <span className="chip bg-ember-500/20 text-ember-300">🏆 Prize <TokenIcon token="usdc" size={14} /> {fmt(b.bounty > 0n ? b.bounty : 0n, 6)}</span>
        <span className="chip bg-grape-600/50 text-grape-100">🎯 Target {fmt(b.target > 0n ? b.target : 0n, 6)}</span>
        <span className="chip bg-grape-600/50 text-grape-100">⏳ {duration(f.lengthSec)} window</span>
        <span className="chip bg-grape-600/50 text-grape-100">Cap {f.capPrice || '?'} tUSDC</span>
      </div>
      <p className="relative mt-3 text-xs text-grape-300">
        To win, the crew must buy <b className="text-white">{pct}%</b> of your wall before the drawn end block.
      </p>
    </div>
  )
}
