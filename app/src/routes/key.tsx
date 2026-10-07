import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import { EmptyState } from '../components/empty'
import { Guide } from '../components/mascots'
import { WalletButton } from '../components/wallet'
import { EXPLORER } from '../lib/config'
import { fmt } from '../lib/format'
import { useOneTap } from '../lib/onetap'
import { useWalletKit } from '../lib/player'
import { play } from '../lib/sfx'
import { blockieOf } from '../lib/profile'
import { AmountInput, fmtPlain, parseAmount } from '../components/amount'
import { TokenIcon, type Token } from '../components/token'
import { BrickBackdrop } from './index'

export const Route = createFileRoute('/key')({ component: KeyPage })

/** Your raid key: where it is, what it holds, how long the seat pass lasts, and the buttons to manage it. */
function KeyPage() {
  const kit = useWalletKit()
  // The key is per wallet, not per raid; the raid id only matters for hits, which this page never sends.
  const one = useOneTap('0')
  const [copied, setCopied] = useState(false)
  const [spin, setSpin] = useState(false)
  const now = Date.now() / 1000
  const daysLeft = one.passExpiry ? Math.max(0, (one.passExpiry - now) / 86400) : 0
  const tokenId = one.session?.tokenId ?? kit.myStars[0] ?? null
  const gasHits = one.minGas > 0n ? Number(one.mon / one.minGas) : 0

  const refresh = async () => {
    setSpin(true)
    play('click')
    await one.refresh()
    kit.refetch()
    setTimeout(() => setSpin(false), 400)
  }

  return (
    <main className="flex min-h-dvh flex-col pt-28">
      <BrickBackdrop className="flex-1 pb-16 pt-6">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="title-outline -rotate-1 text-5xl sm:text-6xl">Raid key</h1>
              <p className="mt-2 max-w-md text-grape-300">One-tap plays from this key. It lives in this browser only, is set up once, and works in every raid while the seat pass lasts.</p>
            </div>
            <Guide who="chog" pose={one.ready ? 'cheer' : 'wait'} size="h-24">
              {!kit.address ? 'Connect your wallet to see your raid key.' : !one.hasKey ? 'No raid key yet. Set it up once from any raid, or right here.' : one.ready ? 'All set! Every raid is tap-to-hit.' : 'Your key needs a little attention below.'}
            </Guide>
          </div>

          {!kit.address ? (
            <div className="mt-8">
              <EmptyState scene="no-star" title="Connect a wallet" size="lg" action={<WalletButton big />}>
                Your raid key belongs to the wallet that set it up.
              </EmptyState>
            </div>
          ) : !one.hasKey ? (
            <div className="mt-8">
              <EmptyState scene="no-seats" title="No raid key yet" size="lg" action={<SetupBox one={one} tokenId={tokenId} label="⚡ Set up one-tap" />}>
                One signature and one funding step. After that every raid is tap-to-hit for 7 days.
              </EmptyState>
            </div>
          ) : (
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="panel mt-8 p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                {/* The raid key is its own address, so it gets its own blockie (not the Star's art). */}
                <img src={blockieOf(one.keyAddress ?? '0x0')} alt="" className="mx-auto h-24 w-24 shrink-0 rounded-3xl shadow-[0_0_0_4px_#2d2250,0_0_0_7px_#7a6eb2,0_8px_0_#15122a] sm:mx-0" style={{ imageRendering: 'pixelated' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`chip ${one.ready ? 'bg-mint text-grape-900' : 'bg-ember-500 text-white'}`}>{one.ready ? 'Ready' : 'Needs attention'}</span>
                    {tokenId && (
                      <span className="chip bg-grape-800 text-grape-100">
                        <TokenIcon token="lilstar" size={14} /> plays Star #{tokenId}
                      </span>
                    )}
                    <button onClick={refresh} className="btn btn-ghost h-8 px-3 text-xs" title="Refresh balances">
                      <motion.span animate={{ rotate: spin ? 360 : 0 }} transition={{ duration: 0.5 }} className="inline-block">
                        ↻
                      </motion.span>
                      Refresh
                    </button>
                  </div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-widest text-grape-300">Key address</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="truncate rounded-xl bg-grape-950/70 px-3 py-1.5 font-mono text-sm text-white">{one.keyAddress}</code>
                    <button
                      className="btn btn-ghost h-8 px-3 text-xs"
                      onClick={async () => {
                        await navigator.clipboard.writeText(one.keyAddress ?? '')
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1500)
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <a className="btn btn-ghost h-8 px-3 text-xs" href={`${EXPLORER}/address/${one.keyAddress}`} target="_blank" rel="noreferrer">
                      Explorer ↗
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon="usdc" label="tUSDC" value={fmt(one.usdc, 6)} hint="to raid with" warn={one.usdc === 0n} />
                <Stat icon="mon" label="MON gas" value={(Number(one.mon) / 1e18).toFixed(2)} hint={`about ${gasHits} hits`} warn={gasHits < 2} />
                <Stat icon="star" label="tSTAR on key" value={fmt(one.star, 18)} hint={one.star > 0n ? 'tap Return to send it home' : 'you buy it in raids, never deposit'} />
                <Stat label="Seat pass" value={one.passValid ? `${daysLeft >= 1 ? Math.floor(daysLeft) + 'd' : Math.max(1, Math.round(daysLeft * 24)) + 'h'}` : 'expired'} hint={one.passExpiry ? `until ${new Date(one.passExpiry * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'not signed'} warn={!one.passValid || daysLeft < 1} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-grape-950/60 p-3">
                <TokenIcon token="mon" size={22} />
                <div className="min-w-[10rem] flex-1">
                  <div className="flex justify-between text-xs text-grape-300">
                    <span className="font-bold text-white">Gas tank</span>
                    <span>{one.gasPct}% · about {gasHits} hits</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-grape-950"><div className={`h-full rounded-full ${one.gasPct < 35 ? 'bg-candy-500' : one.gasPct < 70 ? 'bg-ember-400' : 'bg-mint'}`} style={{ width: `${one.gasPct}%` }} /></div>
                </div>
                <button className="btn btn-candy px-4 py-2 text-sm" disabled={!!one.status || one.gasFull} onClick={() => one.fillGas()}>
                  {one.gasFull ? '⛽ Tank full' : '⛽ Fill gas'}
                </button>
              </div>

              {/* tSTAR is what you get, not what you put in. Spell out the loop so the 0 doesn't read as a missing deposit. */}
              <div className="mt-3 rounded-2xl bg-grape-950/60 p-3 text-xs text-grape-300">
                <div className="mb-2 font-bold text-white">How the tokens move</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="chip bg-grape-800 text-grape-100"><TokenIcon token="usdc" size={14} /> tUSDC in</span>
                  <span>→ each HIT buys</span>
                  <span className="chip bg-grape-800 text-grape-100"><TokenIcon token="star" size={14} /> tSTAR</span>
                  <span>→ held for your seat →</span>
                  <span className="chip bg-ember-500/20 text-ember-300">🗝 Claim after the raid</span>
                  <span>→ your wallet</span>
                </div>
                <p className="mt-2">You never deposit tSTAR. You only send tUSDC (to hit) and MON (for gas). Win and the claim also pays your prize share in tUSDC.</p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-grape-950/60 p-4">
                  <div className="font-display text-lg text-white">Top up</div>
                  <p className="mb-3 text-sm text-grape-300">Send tUSDC from your wallet to the raid key. One popup. Gas has its own <b className="text-white">Fill gas</b> button above.</p>
                  <SetupBox one={one} tokenId={tokenId} label="⚡ Send to raid key" />
                </div>
                <div className="rounded-2xl bg-grape-950/60 p-4">
                  <div className="font-display text-lg text-white">Seat pass</div>
                  <p className="mb-3 text-sm text-grape-300">{one.passValid ? 'Renew any time for another 7 days. Just a signature, nothing is sent.' : 'Your pass expired. Sign a new one to keep hitting with this key.'}</p>
                  <button className="btn btn-candy w-full py-2.5" disabled={!tokenId || !!one.status} onClick={() => tokenId && one.renew(tokenId)}>
                    ✍ Renew pass (7 days)
                  </button>
                  <div className="mt-4 font-display text-lg text-white">Return to wallet</div>
                  <p className="mb-3 text-sm text-grape-300">Sends all tUSDC, tSTAR and MON on the key back to your wallet. Set up again later with a top up.</p>
                  <button className="btn btn-ghost w-full py-2.5" disabled={!!one.status || (one.usdc === 0n && one.star === 0n && one.mon === 0n)} onClick={() => one.sweep(true)}>
                    ↩ Return everything
                  </button>
                </div>
              </div>
              {one.status && <p className="mt-4 text-center text-sm text-ember-300">{one.status}…</p>}
              <p className="mt-4 text-center text-xs text-grape-300">
                The key is stored in this browser. Clearing site data loses it, so return funds first. <Link to="/raids" className="underline">Find a raid →</Link>
              </p>
            </motion.div>
          )}
        </div>
      </BrickBackdrop>
    </main>
  )
}

function Stat({ label, value, hint, warn = false, icon }: { label: string; value: string; hint: string; warn?: boolean; icon?: Token }) {
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${warn ? 'bg-ember-500/15 ring-2 ring-ember-400/60' : 'bg-grape-950/60'}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-grape-300">{label}</div>
      <div className="flex items-center justify-center gap-1.5 font-display text-2xl text-white">
        {icon && <TokenIcon token={icon} size={22} />}
        {value}
      </div>
      <div className="text-[11px] text-grape-300">{hint}</div>
    </div>
  )
}

/**
 * Transfer box: type an amount or drag the % of your wallet's tUSDC, see both balances, send.
 * Testnet easter egg: tap the tUSDC coin 3 times to mint 50 free test tUSDC.
 */
/** Send any amount of tUSDC (up to the wallet balance) to the raid key. */
function SetupBox({ one, tokenId, label }: { one: ReturnType<typeof useOneTap>; tokenId: string | null; label: string }) {
  const kit = useWalletKit()
  const [text, setText] = useState('10')
  const amount = parseAmount(text)
  const bad = amount <= 0n || amount > (kit.usdc ?? 0n)
  return (
    <div>
      <AmountInput value={text} onChange={setText} keyBalance={one.usdc} />
      <button className="btn btn-primary mt-3 w-full py-2.5" disabled={!tokenId || !!one.status || bad} onClick={() => tokenId && one.arm(tokenId, one.usdc + amount)}>
        {label} {!bad ? <>· <TokenIcon token="usdc" size={16} /> {fmtPlain(amount)}</> : null}
      </button>
      {!tokenId && <p className="mt-2 text-xs text-grape-300">You need a Lil Star first. Mint a free test one from the lobby.</p>}
    </div>
  )
}
