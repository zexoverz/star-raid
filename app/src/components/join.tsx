import { Link } from '@tanstack/react-router'
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
import { StarAvatar } from './game'
import { AmountInput, fmtPlain, parseAmount } from './amount'
import { EmptyState } from './empty'
import { FloatingHit, HitPad } from './hitpad'
import { Guide } from './mascots'
import { openGuide } from './guide'
import { TokenIcon } from './token'
import { WalletButton } from './wallet'


/**
 * Joining in three beats:
 *   1. Starter kit (testnet only): mint a test Star + tUSDC.
 *   2. Set up one-tap once: pick your Star and a budget, read the plain confirm sheet, sign one seat
 *      pass (7 days, any raid) and fund one raid key kept in this browser.
 *   3. In this raid and every later one: tap HIT as often as you like. No popups.
 */
export function JoinPanel({ frame, phase }: { frame: Frame; phase: Phase }) {
  const kit = useWalletKit()
  const one = useOneTap(frame.raidId)
  const keySeat = usePlayerSeat(frame.raidId, one.keyAddress)
  const act = useActions()
  const t = frame.terms
  const open = phase === 'live' || phase === 'danger'
  const [pick, setPick] = useState<string | null>(null)
  const [budgetText, setBudgetText] = useState('25')
  const budgetUnits = parseAmount(budgetText)
  const [confirm, setConfirm] = useState(false)
  const [amount, setAmount] = useState(parseUnits('5', t.quoteDecimals))
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
        <Guide who="bear" pose="cheer">This wallet posted the raid. Sponsors can't hit their own wall. Cheer from the side!</Guide>
      </Shell>
    )

  const needStar = kit.myStars.length === 0 && !one.session
  const needUsdc = (kit.usdc ?? 0n) < (budgetUnits > 0n ? budgetUnits : 1n) && !one.session

  // ---- Set up once: the one-tap pad, in this raid and every later one
  if (one.session) {
    const lowGas = one.mon < parseUnits('0.4', 18)
    const noUsdc = one.usdc < amount
    const passDays = one.passExpiry ? Math.max(0, Math.round((one.passExpiry - Date.now() / 1000) / 86400)) : 0
    return (
      <Shell>
        <StrandedNotice one={one} />
        <HitPad
          tokenId={one.session.tokenId}
          decimals={t.quoteDecimals}
          balance={one.usdc}
          open={open && one.ready}
          label={open ? '⚔ HIT!' : phase === 'upcoming' ? 'Get ready…' : 'Window closed'}
          hits={one.hits}
          inflight={one.inflight}
          onAmount={setAmount}
          onHit={(amount) => one.tap(amount)}
          refill={
            open && (lowGas || noUsdc)
              ? { label: `⚡ Top up ${noUsdc ? `${fmtPlain(budgetUnits)} tUSDC` : ''}${noUsdc && lowGas ? ' + ' : ''}${lowGas ? 'gas' : ''}`, busy: !!one.status, onClick: () => void one.arm(one.session!.tokenId, one.usdc + budgetUnits).then((ok) => ok && kit.refetch()) }
              : undefined
          }
          error={null}
          footer={
            <>
              {one.status && <p className="mt-3 text-sm text-grape-300">{one.status}…</p>}
              {!open && (lowGas || noUsdc) && (
                <button className="btn btn-candy mt-3 w-full py-2.5" disabled={!!one.status} onClick={() => one.arm(one.session!.tokenId, one.usdc + budgetUnits).then((ok) => ok && kit.refetch())}>
                  ⚡ Top up {noUsdc ? `${fmtPlain(budgetUnits)} tUSDC` : ''}{noUsdc && lowGas ? ' + ' : ''}{lowGas ? 'gas' : ''} (one popup)
                </button>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-grape-700 pt-3 text-center text-xs text-grape-300">
                <div><div className="font-display text-base text-white">{fmt(one.usdc, t.quoteDecimals)}</div>tUSDC on key</div>
                <div>
                  <div className="font-display text-base text-white">{one.gasHits} hits</div>
                  <button className="underline hover:text-white disabled:no-underline disabled:opacity-60" disabled={!!one.status || one.gasFull} onClick={() => one.fillGas()}>
                    {one.gasFull ? 'gas full' : '⛽ fill gas'}
                  </button>
                </div>
                <div><div className="font-display text-base text-white">{passDays}d</div>pass left</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-grape-300">
                <span title={one.keyAddress}>Raid key {one.keyAddress?.slice(0, 8)}… stays in this browser, set up once.</span>
                <span className="flex shrink-0 gap-3">
                  <button className="underline hover:text-white" onClick={() => one.refresh()}>
                    ↻ Refresh
                  </button>
                  <Link to="/key" className="underline hover:text-white">
                    Manage key
                  </Link>
                  <button className="underline hover:text-white" disabled={!!one.status} onClick={() => one.sweep(true)}>
                    Return to wallet
                  </button>
                </span>
              </div>
              {keySeat.seatKey && <p className="mt-1 text-[11px] text-grape-300">Your bought tSTAR is held for this seat; claim it from here after settle.</p>}
            </>
          }
        />
        <FloatingHit open={open && one.ready && one.usdc >= amount} amount={amount} onHit={(a) => one.tap(a)} />
      </Shell>
    )
  }

  // ---- Not armed: setup
  return (
    <Shell>
      <StrandedNotice one={one} />
      <Guide who={needStar ? 'chog' : 'fox'} pose={needStar ? 'wait' : open ? 'attack' : 'think'} size="h-28">
        {needStar || needUsdc ? 'First, grab a test Star and some test USDC. They are free on testnet!' : open ? 'The wall is up! Set up one-tap and start hitting.' : 'Set up one-tap now. You only do it once, then every raid is tap-to-hit.'}
      </Guide>
      <button className="mb-3 w-full text-center text-xs text-candy-300 underline hover:text-white" onClick={() => openGuide()}>
        New here? Show me the 3 steps
      </button>

      {(needStar || needUsdc) && (
        <button className="btn btn-candy mb-4 mt-1 w-full py-3" disabled={act.busy} onClick={() => act.getTestKit(needStar, needUsdc).then((ok) => ok && (kit.refetch(), play('coin')))}>
          {needStar && <TokenIcon token="blindbox" size={22} className="mr-1" />}{needUsdc && <TokenIcon token="usdc" size={20} className="mr-1" />}{needStar && needUsdc ? 'Mint a Star + 50 tUSDC' : needStar ? 'Mint a test Star' : 'Mint 50 tUSDC'}
        </button>
      )}
      <TxSteps steps={act.steps} error={act.error} />

      <Label><TokenIcon token="lilstar" size={14} className="mr-1" />Your Star</Label>
      {kit.myStars.length === 0 ? (
        <EmptyState scene="no-star" title="No Star in this wallet yet" size="sm" className="mb-4">
          A Lil Star is your seat. Mint a free test one above.
        </EmptyState>
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
        Raid budget <span className="normal-case tracking-normal">· any amount, up to your wallet</span>
      </Label>
      <div className="mb-4">
        <AmountInput value={budgetText} onChange={setBudgetText} keyBalance={one.usdc} />
      </div>

      <button className="btn btn-primary w-full py-4 text-2xl" disabled={!myStar || needUsdc || !!one.status || phase === 'drawing'} onClick={() => (play('click'), setConfirm(true))}>
        ⚡ Set up one-tap
      </button>
      <p className="mt-2 text-center text-xs text-grape-300">Set up once: one signature + one funding step. It then works in every raid for {7} days, with no popups.</p>
      {one.status && <p className="mt-3 text-center text-sm text-ember-300">{one.status}…</p>}

      <AnimatePresence>
        {confirm && myStar && (
          <ConfirmSheet
            frame={frame}
            budget={budgetUnits}
            tokenId={myStar}
            onCancel={() => setConfirm(false)}
            onGo={async () => {
              setConfirm(false)
              const ok = await one.arm(myStar, one.usdc + budgetUnits)
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
        <h3 className="text-xl font-extrabold">Before you set up one-tap</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <Row k="Moved to your raid key" v={`${fmt(budget, t.quoteDecimals, 6)} tUSDC + about 1.4 MON for gas (8 hits)`} />
          <Row k="Cap price (this raid)" v={t.capPrice ? `${fmt(t.capPrice, t.quoteDecimals, 6)} tUSDC per tSTAR` : 'set when the raid opens'} />
          <Row k="Seat" v={`Lil Star #${tokenId}`} />
          <Row k="Seat pass valid for" v="7 days, every raid" />
          <Row k="Hold after settle" v={duration(t.hold)} />
        </dl>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>You sign one seat pass that lets a raid key created in this browser play your Stars' seats in any raid for 7 days. The key stays in this browser, is never sent anywhere, and can only spend the tUSDC and MON you move to it.</li>
          <li>The raid key approves the raid router once, so later raids need no popup. Each tap buys tSTAR at or below that raid's cap price. Cheaper asks on the book fill first. Anything not filled is cancelled in the same transaction and refunded to the raid key.</li>
          <li>Only buys at or before the randomly drawn end block count toward the target.</li>
          <li>The tSTAR you buy is held by the router for your seat. If the raid wins, claims open after the hold. You can exit early after settle, but you forfeit your prize share.</li>
          <li>Kuru's admin can cancel orders on the book, including the sponsor's wall.</li>
          <li>Use "Return to wallet" any time to send the key's tUSDC, tSTAR and MON back. Clearing this browser's site data loses the raid key, so return funds first.</li>
          <li>Testnet, test tokens. Nothing here is a price, return or investment advice.</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-full border-2 border-grape-600 py-3 font-bold" onClick={onCancel}>
            Cancel
          </button>
          <button className="flex-1 rounded-full bg-grape-700 py-3 font-bold text-white" onClick={onGo}>
            I understand, set up
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
      {error && <p className="text-xs text-candy-300">Something went wrong, see the message from Bunnystar.</p>}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="panel p-5">{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-grape-300">{children}</div>
}

/** A raid key from the old one-key-per-raid setup still holds funds: one tap sends them back. */
function StrandedNotice({ one }: { one: ReturnType<typeof useOneTap> }) {
  if (one.stranded.length === 0) return null
  return (
    <div className="dashed-card mb-4 flex items-center gap-3 p-3 text-sm" style={{ ['--card-color' as string]: '#FFB84D' }}>
      <div className="flex-1 text-grape-100">
        An older raid key from this browser still holds some of your tUSDC, tSTAR or MON.
      </div>
      <button className="btn btn-primary shrink-0 px-3 py-1.5 text-xs" disabled={!!one.status} onClick={() => one.recover()}>
        Send it back
      </button>
    </div>
  )
}
