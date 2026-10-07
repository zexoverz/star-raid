import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TokenAmount, TokenIcon } from './token'
import { openGuide } from './guide'
import { useActions, useWalletKit } from '../lib/player'
import { Link } from '@tanstack/react-router'
import { useOneTap } from '../lib/onetap'
import { useAppKit, useAppKitState } from '@reown/appkit/react'
import { useChainId, useConnection, useDisconnect, useSwitchChain } from 'wagmi'
import { CHAIN_ID } from '../lib/config'
import { PlayerPill } from './profile'
import { onSound, play, setSound, soundOn } from '../lib/sfx'

export function WalletButton({ big = false }: { big?: boolean }) {
  const { address, isConnected } = useConnection()
  const { open } = useAppKit()
  const { open: modalOpen } = useAppKitState()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const wrong = isConnected && chainId !== CHAIN_ID

  if (!isConnected) {
    return (
      <button
        className={`btn btn-primary ${big ? 'text-xl px-8 py-4' : 'text-sm px-4 py-2'}`}
        disabled={modalOpen}
        onClick={() => {
          play('click')
          void open({ view: 'Connect' })
        }}
      >
        {modalOpen ? 'Connecting…' : 'Connect wallet'}
      </button>
    )
  }
  if (wrong)
    return (
      <button className="btn btn-candy px-4 py-2 text-sm" onClick={() => switchChain({ chainId: CHAIN_ID })}>
        Switch to Monad testnet
      </button>
    )
  return <ProfileMenu address={address!} openAppKit={() => void open({ view: 'Account' })} />
}

/** Profile pill opens our own dropdown: wallet, raid key status and shortcuts. AppKit only on demand. */
function ProfileMenu({ address, openAppKit }: { address: string; openAppKit: () => void }) {
  const [menu, setMenu] = useState(false)
  const one = useOneTap('0')
  const { disconnect } = useDisconnect()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])
  const status = !one.hasKey ? { t: 'Not set up', c: 'bg-candy-500 text-white' } : one.ready ? { t: 'Ready', c: 'bg-mint text-grape-900' } : { t: 'Needs top up', c: 'bg-ember-500 text-white' }
  return (
    <div ref={ref} className="relative">
      <button className="btn btn-ghost py-1.5 pl-1.5 pr-3 text-sm" onClick={() => (play('click'), setMenu((m) => !m))} aria-expanded={menu}>
        <PlayerPill address={address} size={28} className="max-w-[11rem]" />
        <span className={`h-2.5 w-2.5 rounded-full ${one.ready ? 'bg-mint' : one.hasKey ? 'bg-ember-400' : 'bg-candy-500'}`} title={`One-tap: ${status.t}`} />
      </button>
      <AnimatePresence>
        {menu && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} className="panel absolute right-0 top-full z-50 mt-2 w-72 p-3 text-sm">
            <div className="flex items-center gap-2 rounded-2xl bg-grape-950/60 p-2">
              <PlayerPill address={address} size={36} />
            </div>
            <div className="mt-3 rounded-2xl bg-grape-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-white">🗝 Raid key</span>
                <span className={`chip ${status.c}`}>{status.t}</span>
              </div>
              {one.hasKey && (
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px] text-grape-300">
                  <div><TokenAmount token="usdc" value={one.usdc} decimals={6} /></div>
                  <div><TokenAmount token="mon" value={one.mon} decimals={18} dp={2} /></div>
                  <div><b className="text-white">{one.passExpiry ? Math.max(0, Math.floor((one.passExpiry - Date.now() / 1000) / 86400)) : 0}d</b> pass</div>
                </div>
              )}
              <Link to="/key" onClick={() => setMenu(false)} className="btn btn-primary mt-3 w-full py-2 text-sm">
                {one.hasKey ? 'Manage raid key' : 'Set up one-tap'}
              </Link>
            </div>
            <MintRow />
            <button className="mt-2 w-full rounded-2xl px-3 py-2 text-left font-bold text-grape-100 hover:bg-white/10" onClick={() => (setMenu(false), openGuide())}>
              ❓ How to raid (guide)
            </button>
            <button className="mt-2 w-full rounded-2xl px-3 py-2 text-left font-bold text-grape-100 hover:bg-white/10" onClick={() => (setMenu(false), openAppKit())}>
              Wallet and network…
            </button>
            <button className="w-full rounded-2xl px-3 py-2 text-left font-bold text-candy-300 hover:bg-white/10" onClick={() => (setMenu(false), disconnect())}>
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Testnet faucet: anyone can mint test tUSDC and a test Lil Star. */
function MintRow() {
  const act = useActions()
  const kit = useWalletKit()
  const mint = (star: boolean, usdc: boolean) => act.getTestKit(star, usdc).then((ok) => ok && (kit.refetch(), play('coin')))
  return (
    <div className="mt-2 rounded-2xl bg-grape-950/60 p-3">
      <div className="flex items-center justify-between text-xs text-grape-300">
        <span className="font-display text-sm text-white">Testnet faucet</span>
        <TokenAmount token="usdc" value={kit.usdc ?? 0n} decimals={6} size={13} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn btn-candy py-1.5 text-xs" disabled={act.busy} onClick={() => mint(false, true)}>
          <TokenIcon token="usdc" size={14} /> +50 tUSDC
        </button>
        <button className="btn btn-ghost py-1.5 text-xs" disabled={act.busy} onClick={() => mint(true, false)}>
          <TokenIcon token="blindbox" size={14} /> Mint a Star
        </button>
      </div>
      {act.busy && <p className="mt-1 text-[11px] text-grape-300">Confirm in your wallet…</p>}
    </div>
  )
}

export function SoundToggle() {
  const [on, setOn] = useState(soundOn())
  useEffect(() => {
    const off = onSound(setOn)
    return () => void off()
  }, [])
  return (
    <button
      className="btn btn-ghost h-10 w-10 !p-0 text-lg"
      title={on ? 'Sound on' : 'Sound off'}
      aria-label="Toggle sound"
      onClick={() => {
        setSound(!on)
        if (!on) play('coin')
      }}
    >
      {on ? '🔊' : '🔈'}
    </button>
  )
}

