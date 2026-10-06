import { useEffect, useState } from 'react'
import { useAppKit, useAppKitState } from '@reown/appkit/react'
import { useChainId, useConnection, useSwitchChain } from 'wagmi'
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
  return (
    <button className="btn btn-ghost py-1.5 pl-1.5 pr-4 text-sm" title="Wallet" onClick={() => void open({ view: 'Account' })}>
      <PlayerPill address={address} size={28} className="max-w-[11rem]" />
    </button>
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
