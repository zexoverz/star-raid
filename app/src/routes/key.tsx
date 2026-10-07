import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { EmptyState } from '../components/empty'
import { Guide } from '../components/mascots'
import { WalletButton } from '../components/wallet'
import { EXPLORER } from '../lib/config'
import { fmt } from '../lib/format'
import { useOneTap } from '../lib/onetap'
import { useActions, useWalletKit } from '../lib/player'
import { play } from '../lib/sfx'
import { blockieOf } from '../lib/profile'
import { TokenAmount, TokenIcon, type Token } from '../components/token'
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
                <Stat icon="star" label="tSTAR" value={fmt(one.star, 18)} hint="bought, not yet returned" />
                <Stat label="Seat pass" value={one.passValid ? `${daysLeft >= 1 ? Math.floor(daysLeft) + 'd' : Math.max(1, Math.round(daysLeft * 24)) + 'h'}` : 'expired'} hint={one.passExpiry ? `until ${new Date(one.passExpiry * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'not signed'} warn={!one.passValid || daysLeft < 1} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-grape-950/60 p-4">
                  <div className="font-display text-lg text-white">Top up</div>
                  <p className="mb-3 text-sm text-grape-300">Send tUSDC from your wallet to the raid key. Gas is refilled too if it's low. One popup.</p>
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
function SetupBox({ one, tokenId, label }: { one: ReturnType<typeof useOneTap>; tokenId: string | null; label: string }) {
  const kit = useWalletKit()
  const act = useActions()
  const wallet = kit.usdc ?? 0n
  const [text, setText] = useState('10')
  const [taps, setTaps] = useState(0)
  const amount = (() => {
    try {
      return text.trim() ? parseUnits(text.trim(), 6) : 0n
    } catch {
      return -1n
    }
  })()
  const pct = wallet > 0n && amount > 0n ? Math.min(100, Number((amount * 10000n) / wallet) / 100) : 0
  const setPct = (p: number) => setText(fmtPlain((wallet * BigInt(Math.round(p * 100))) / 10000n))
  const tooMuch = amount > wallet
  const bad = amount <= 0n || tooMuch
  const egg = () => {
    const n = taps + 1
    setTaps(n)
    play('click')
    if (n >= 3) {
      setTaps(0)
      void act.getTestKit(false, true).then((ok) => ok && (kit.refetch(), play('coin')))
    }
  }
  return (
    <div>
      <div className={`flex items-center gap-2 rounded-2xl bg-grape-950/70 px-3 py-2 ring-2 ${tooMuch || amount < 0n ? 'ring-candy-500' : 'ring-transparent focus-within:ring-ember-400'}`}>
        <button type="button" onClick={egg} title={taps ? `${3 - taps} more…` : 'tUSDC'} className={`shrink-0 transition-transform active:scale-90 ${taps ? 'animate-wiggle' : ''}`}>
          <TokenIcon token="usdc" size={28} />
        </button>
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
          className="min-w-0 flex-1 bg-transparent font-display text-2xl text-white outline-none placeholder:text-grape-600"
          placeholder="0"
          aria-label="Amount of tUSDC to send to the raid key"
        />
        <button type="button" className="chip bg-grape-700 text-grape-100 hover:bg-grape-600" onClick={() => setPct(100)}>
          MAX
        </button>
      </div>
      <input type="range" min={0} max={100} step={1} value={Math.round(pct)} onChange={(e) => setPct(Number(e.target.value))} className="mt-3 w-full accent-[#FF8C42]" aria-label="Percent of wallet tUSDC" />
      <div className="mt-1 flex gap-1.5">
        {[25, 50, 75, 100].map((p) => (
          <button key={p} type="button" onClick={() => setPct(p)} className={`flex-1 rounded-lg py-1 text-xs font-bold ${Math.round(pct) === p ? 'bg-ember-500 text-white' : 'bg-grape-800 text-grape-200 hover:bg-grape-700'}`}>
            {p}%
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-grape-300">
        <div className="rounded-xl bg-grape-950/50 px-2 py-1.5">
          Wallet <TokenAmount token="usdc" value={wallet} decimals={6} size={12} />
          <div>{tooMuch ? <span className="text-candy-300">not enough</span> : `${Math.round(pct)}% of it`}</div>
        </div>
        <div className="rounded-xl bg-grape-950/50 px-2 py-1.5">
          Raid key <TokenAmount token="usdc" value={one.usdc} decimals={6} size={12} />
          <div>after: {fmtPlain(one.usdc + (amount > 0n ? amount : 0n))}</div>
        </div>
      </div>
      {act.busy && <p className="mt-2 text-xs text-ember-300">Minting test tUSDC, confirm in your wallet…</p>}
      <button className="btn btn-primary mt-3 w-full py-2.5" disabled={!tokenId || !!one.status || bad} onClick={() => tokenId && one.arm(tokenId, one.usdc + amount)}>
        {label} {amount > 0n && !tooMuch ? <>· <TokenIcon token="usdc" size={16} /> {fmtPlain(amount)}</> : null}
      </button>
      {!tokenId && <p className="mt-2 text-xs text-grape-300">You need a Lil Star first. Mint a free test one from the lobby.</p>}
    </div>
  )
}

const fmtPlain = (v: bigint) => {
  const s = formatUnits(v, 6)
  return s.includes('.') ? s.replace(/\.?0+$/, '').replace(/(\.\d{2})\d+$/, '$1') : s
}
