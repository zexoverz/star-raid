import { useEffect, useState } from 'react'
import { useAppKit, useAppKitState } from '@reown/appkit/react'
import { useChainId, useConnection, useSwitchChain } from 'wagmi'
import { CHAIN_ID } from '../lib/config'
import { short } from '../lib/format'
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
    <button className="btn btn-ghost px-4 py-2 text-sm" title="Wallet" onClick={() => void open({ view: 'Account' })}>
      <span className="h-2.5 w-2.5 rounded-full bg-mint shadow-[0_0_8px_#a3e3c1]" />
      {short(address)}
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
