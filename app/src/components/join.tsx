import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { parseUnits } from 'viem'
import { fmt, duration } from '../lib/format'
import { useOneTap } from '../lib/onetap'
import type { Phase } from '../lib/phase'
import { useActions, usePlayerSeat, useWalletKit } from '../lib/player'
import { play } from '../lib/sfx'
import { STAR_NAMES, starArt } from '../lib/stars'
import type { Frame } from '../lib/types'
import { Sprite, StarAvatar } from './game'
import { Guide } from './mascots'
import { WalletButton } from './wallet'

const HIT_SIZES = [3, 5, 10]
const BUDGETS = [10, 25, 50]

/**
 * Joining in three beats:
 *   1. Starter kit (testnet only): mint a test Star + tUSDC.
 *   2. Arm one-tap: pick your Star and a budget, read the plain confirm sheet, sign one seat pass
 *      and fund a throwaway raid key. That is the only time the wallet pops up.
 *   3. Tap HIT as often as you like while the window is open. No popups.
 */
export function JoinPanel({ frame, phase }: { frame: Frame; phase: Phase }) {
  const kit = useWalletKit()
  const one = useOneTap(frame.raidId)
  const keySeat = usePlayerSeat(frame.raidId, one.keyAddress)
  const act = useActions()
  const t = frame.terms
  const open = phase === 'live' || phase === 'danger'
  const [pick, setPick] = useState<string | null>(null)
  const [budget, setBudget] = useState(25)
  const [hit, setHit] = useState(5)
  const [confirm, setConfirm] = useState(false)
  const [burst, setBurst] = useState(0)
  const isSponsor = kit.address && kit.address.toLowerCase() === t.sponsor.toLowerCase()
  const myStar = useMemo(() => one.session?.tokenId ?? pick ?? kit.myStars[0] ?? null, [one.session, pick, kit.myStars])

  if (!kit.address)
    return (
      <Shell>
        <Guide who="fox" size="h-28">
          Connect a wallet on Monad testnet and grab a seat. Watching is free!
        </Guide>
        <div className="mt-2">
          <WalletButton big />
        </div>
      </Shell>
    )

  if (isSponsor)
    return (
      <Shell>
        <Guide who="bear">This wallet posted the raid. Sponsors can't hit their own wall. Cheer from the side!</Guide>
      </Shell>
    )

  const needStar = kit.myStars.length === 0 && !one.session
  const needUsdc = (kit.usdc ?? 0n) < parseUnits(String(budget), t.quoteDecimals) && !one.session

  // ---- Armed: the one-tap pad
  if (one.session) {
    const hitUnits = parseUnits(String(hit), t.quoteDecimals)
    const canHit = open && one.usdc >= hitUnits && one.mon > 0n
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <StarAvatar tokenId={one.session.tokenId} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg leading-tight text-white">One-tap armed</div>
            <div className="text-xs text-grape-300">
              Star #{one.session.tokenId} · {fmt(one.usdc, t.quoteDecimals)} tUSDC left · {one.hits} hits landed
            </div>
          </div>
          <span className="chip bg-mint/20 text-mint">⚡ no popups</span>
        </div>

        <div className="mt-4 flex gap-2">
          {HIT_SIZES.map((h) => (
            <button key={h} onClick={() => (setHit(h), play('click'))} className={`flex-1 rounded-2xl py-2 font-display text-lg transition ${hit === h ? 'bg-ember-500 text-white shadow-[0_4px_0_#b4470a]' : 'bg-grape-800 text-grape-100 hover:bg-grape-700'}`}>
              {h}
              <span className="ml-1 text-xs opacity-70">tUSDC</span>
            </button>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          disabled={!canHit}
          onClick={async () => {
            play('hit')
            setBurst((b) => b + 1)
            await one.tap(hitUnits)
          }}
          className="btn btn-primary relative mt-4 h-28 w-full overflow-visible text-4xl"
        >
          <AnimatePresence>
            <motion.span key={burst} className="pointer-events-none absolute inset-0 grid place-items-center" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5 }}>
              {burst > 0 && <Sprite name="hit_spark" className="h-40 w-40" />}
            </motion.span>
          </AnimatePresence>
          {open ? '⚔ HIT!' : phase === 'upcoming' ? 'Get ready…' : 'Window closed'}
        </motion.button>
        <div className="mt-2 flex justify-between text-xs text-grape-300">
          <span>{one.inflight > 0 ? `${one.inflight} hit(s) flying…` : 'Tap as fast as you like'}</span>
          <span>gas {Number(one.mon) / 1e18 < 0.01 ? 'low!' : `${(Number(one.mon) / 1e18).toFixed(2)} MON`}</span>
        </div>
        {one.usdc < hitUnits && open && <p className="mt-2 text-xs text-candy-300">Budget used up. Sweep back and arm again to keep hitting.</p>}
        {one.error && <p className="mt-3 rounded-xl bg-candy-600/30 p-2 text-sm text-candy-300">{one.error}</p>}
        {one.status && <p className="mt-3 text-sm text-grape-300">{one.status}…</p>}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-grape-700 pt-3 text-xs text-grape-300">
          <span title={one.keyAddress}>Raid key {one.keyAddress?.slice(0, 8)}… lives only in this tab</span>
          <button className="underline hover:text-white" disabled={!!one.status} onClick={() => one.sweep()}>
            Return leftovers
          </button>
        </div>
        {keySeat.seatKey && <p className="mt-1 text-[11px] text-grape-300">Your bought tSTAR is held for this seat; claim it from here after settle.</p>}
      </Shell>
    )
  }

  // ---- Not armed: setup
  return (
    <Shell>
      <Guide who={needStar ? 'chog' : 'fox'} size="h-24">
        {needStar || needUsdc ? 'First, grab a test Star and some test USDC. They are free on testnet!' : open ? 'The wall is up! Arm one-tap and start hitting.' : 'Arm now, so you are ready the second it opens.'}
      </Guide>

      {(needStar || needUsdc) && (
        <button className="btn btn-candy mb-4 mt-1 w-full py-3" disabled={act.busy} onClick={() => act.getTestKit(needStar, needUsdc).then((ok) => ok && (kit.refetch(), play('coin')))}>
          🎁 {needStar && needUsdc ? 'Mint a Star + 50 tUSDC' : needStar ? 'Mint a test Star' : 'Mint 50 tUSDC'}
        </button>
      )}
      <TxSteps steps={act.steps} error={act.error} />

      <Label>Your Star</Label>
      {kit.myStars.length === 0 ? (
        <p className="mb-4 text-sm text-grape-300">No Star in this wallet yet.</p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {kit.myStars.slice(0, 8).map((id) => {
            const a = starArt(id)
            const sel = id === myStar
            return (
              <button key={id} onClick={() => (setPick(id), play('click'))} className={`dashed-card flex items-center gap-2 p-1.5 pr-3 transition ${sel ? 'scale-105 bg-ember-500/20' : 'opacity-70 hover:opacity-100'}`} style={{ ['--card-color' as string]: sel ? '#FFB84D' : '#7a6eb2' }}>
                <StarAvatar tokenId={id} size={40} />
                <div className="text-left text-xs">
                  <div className="font-bold text-white">#{id}</div>
                  <div className="text-grape-300">{a ? (STAR_NAMES[a.character] ?? a.character) : ''}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Label>
        Raid budget <span className="normal-case tracking-normal">· you have {kit.usdc !== undefined ? fmt(kit.usdc, t.quoteDecimals) : '…'} tUSDC</span>
      </Label>
      <div className="mb-4 flex gap-2">
        {BUDGETS.map((b) => (
          <button key={b} onClick={() => (setBudget(b), play('click'))} className={`flex-1 rounded-2xl py-2.5 font-display text-xl transition ${budget === b ? 'bg-ember-500 text-white shadow-[0_4px_0_#b4470a]' : 'bg-grape-800 text-grape-100 hover:bg-grape-700'}`}>
            {b}
          </button>
        ))}
      </div>

      <button className="btn btn-primary w-full py-4 text-2xl" disabled={!myStar || needUsdc || !!one.status || phase === 'drawing'} onClick={() => (play('click'), setConfirm(true))}>
        ⚡ Arm one-tap
      </button>
      <p className="mt-2 text-center text-xs text-grape-300">One signature + one funding step. After that, every hit is a single tap.</p>
      {one.status && <p className="mt-3 text-center text-sm text-ember-300">{one.status}…</p>}
      {one.error && <p className="mt-3 rounded-xl bg-candy-600/30 p-2 text-sm text-candy-300">{one.error}</p>}

      <AnimatePresence>
        {confirm && myStar && (
          <ConfirmSheet
            frame={frame}
            budget={parseUnits(String(budget), t.quoteDecimals)}
            tokenId={myStar}
            onCancel={() => setConfirm(false)}
            onGo={async () => {
              setConfirm(false)
              const ok = await one.arm(myStar, parseUnits(String(budget), t.quoteDecimals))
              if (ok) {
                play('join')
                kit.refetch()
              }
            }}
          />
        )}
      </AnimatePresence>
    </Shell>
  )
}

/** The confirm sheet stays plain and serious: no game styling on the words that matter. */
function ConfirmSheet({ frame, budget, tokenId, onCancel, onGo }: { frame: Frame; budget: bigint; tokenId: string; onCancel: () => void; onGo: () => void }) {
  const t = frame.terms
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-end bg-grape-950/80 p-3 backdrop-blur-sm sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-cream-100 p-6 text-grape-900 shadow-2xl" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-extrabold">Before you arm one-tap</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <Row k="Budget moved to your raid key" v={`${fmt(budget, t.quoteDecimals, 6)} tUSDC + 0.6 MON for gas`} />
          <Row k="Cap price" v={t.capPrice ? `${fmt(t.capPrice, t.quoteDecimals, 6)} tUSDC per tSTAR` : 'set when the raid opens'} />
          <Row k="Seat" v={`Lil Star #${tokenId}`} />
          <Row k="Hold after settle" v={duration(t.hold)} />
        </dl>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>You sign one seat pass that lets a raid key created in this browser tab play your Star's seat for one hour. The key is never sent anywhere and can only spend the tUSDC you move to it.</li>
          <li>Each tap buys tSTAR at or below the cap price. Cheaper asks on the book fill first. Anything not filled is cancelled in the same transaction and refunded to the raid key.</li>
          <li>Only buys at or before the randomly drawn end block count toward the target.</li>
          <li>The tSTAR you buy is held by the router for your seat. If the raid wins, claims open after the hold. You can exit early after settle, but you forfeit your prize share.</li>
          <li>Kuru's admin can cancel orders on the book, including the sponsor's wall.</li>
          <li>Use "Return leftovers" to send unused tUSDC, tSTAR and MON back to your wallet. Closing the tab loses the raid key.</li>
          <li>Testnet, test tokens. Nothing here is a price, return or investment advice.</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-full border-2 border-grape-600 py-3 font-bold" onClick={onCancel}>
            Cancel
          </button>
          <button className="flex-1 rounded-full bg-grape-700 py-3 font-bold text-white" onClick={onGo}>
            I understand, arm
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-grape-900/10 pb-1.5">
      <dt className="text-grape-700">{k}</dt>
      <dd className="text-right font-bold">{v}</dd>
    </div>
  )
}

export function TxSteps({ steps, error }: { steps: { label: string; state: string }[]; error: string | null }) {
  if (!steps.length && !error) return null
  return (
    <div className="mb-4 space-y-1.5 rounded-2xl bg-grape-950/60 p-3 text-sm">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="w-5 text-center">{s.state === 'done' ? '✅' : s.state === 'doing' ? <span className="inline-block animate-spin">✦</span> : s.state === 'error' ? '❌' : '○'}</span>
          <span className={s.state === 'done' ? 'text-mint' : s.state === 'error' ? 'text-candy-300' : 'text-white'}>
            {s.label}
            {s.state === 'doing' && <span className="text-grape-300"> · confirm in your wallet</span>}
          </span>
        </div>
      ))}
      {error && <p className="rounded-xl bg-candy-600/30 p-2 text-candy-300">{error}</p>}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="panel p-5">{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-grape-300">{children}</div>
}
