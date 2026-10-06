import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fmt } from '../lib/format'
import { useActions, useWalletKit } from '../lib/player'
import { play } from '../lib/sfx'
import type { LobbyRaid } from '../lib/types'
import { StarAvatar } from './game'
import { TxSteps } from './join'
import { Guide } from './mascots'
import { WalletButton } from './wallet'

/**
 * Demo raids on testnet are posted by the keeper about once an hour (DEMO_EVERY_MIN) and last ~2
 * minutes, so players need to be ready before one appears. This panel lets them get a test Star and
 * tUSDC at any time and shows roughly when the next demo raid is due (an estimate, labelled so).
 */
const DEMO_EVERY_MS = 60 * 60 * 1000

export function GetReady({ latest, live }: { latest?: LobbyRaid; live: boolean }) {
  const kit = useWalletKit()
  const act = useActions()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  // The last demo was posted about 25 s before its w0; settledAt is the best wall-clock anchor we have.
  const anchor = latest?.settledAt ? latest.settledAt * 1000 - 90_000 : null
  const next = anchor ? anchor + DEMO_EVERY_MS : null
  const left = next ? Math.max(0, Math.round((next - now) / 1000)) : null
  const mm = left !== null ? Math.floor(left / 60) : 0
  const ss = left !== null ? left % 60 : 0

  const hasStar = kit.myStars.length > 0
  const hasUsdc = (kit.usdc ?? 0n) >= 10_000_000n

  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="grid items-center gap-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Guide who="fox" pose={live ? 'attack' : 'think'} size="h-28">
            {live
              ? 'A raid is live right now! Jump in from the stage above.'
              : left !== null && left > 0
                ? `Next demo raid in about ${mm}m ${ss.toString().padStart(2, '0')}s. Get your Star and tUSDC now, the window is only about a minute!`
                : 'The next demo raid should appear any moment. Keep this page open, it updates live.'}
          </Guide>
          {!live && left !== null && (
            <div className="mt-2 flex items-center gap-3">
              <div className="font-display text-5xl text-ember-400 tabular-nums">
                {left > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : 'soon'}
              </div>
              <div className="text-xs text-grape-300">
                estimate · demo raids post about hourly
                <br />
                on testnet and last ~2 minutes
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-grape-950/60 p-4">
          <div className="mb-3 font-display text-lg text-white">Get ready</div>
          {!kit.address ? (
            <WalletButton big />
          ) : (
            <>
              <ul className="mb-3 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span>{hasStar ? '✅' : '⬜'}</span>
                  {hasStar ? (
                    <span className="flex items-center gap-2 text-white">
                      <StarAvatar tokenId={kit.myStars[0]} size={28} ring={false} /> Star #{kit.myStars[0]}
                      {kit.myStars.length > 1 ? ` +${kit.myStars.length - 1}` : ''}
                    </span>
                  ) : (
                    <span className="text-grape-300">A test Lil Star (your seat)</span>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  <span>{hasUsdc ? '✅' : '⬜'}</span>
                  <span className={hasUsdc ? 'text-white' : 'text-grape-300'}>{kit.usdc !== undefined ? `${fmt(kit.usdc, 6)} tUSDC` : 'tUSDC'} (at least 10)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>✅</span>
                  <span className="text-grape-300">testnet MON for gas</span>
                </li>
              </ul>
              {!(hasStar && hasUsdc) ? (
                <button className="btn btn-candy w-full py-3" disabled={act.busy} onClick={() => act.getTestKit(!hasStar, !hasUsdc).then((ok) => ok && (kit.refetch(), play('coin')))}>
                  🎁 {!hasStar && !hasUsdc ? 'Mint a Star + 50 tUSDC' : !hasStar ? 'Mint a test Star' : 'Mint 50 tUSDC'}
                </button>
              ) : (
                <p className="text-sm text-mint">You're ready. When the raid appears, open it and arm one-tap.</p>
              )}
              <TxSteps steps={act.steps} error={act.error} />
              <Link to="/practice" className="mt-2 block text-center text-xs text-candy-300 underline">
                Warm up in a practice raid
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
