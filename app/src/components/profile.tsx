import { useState } from 'react'
import { useProfile } from '../lib/profile'

/** Round profile picture: the ENS avatar when the address has one, else its blockie. */
export function ProfileAvatar({ address, size = 18, className = '' }: { address?: string | null; size?: number; className?: string }) {
  const p = useProfile(address)
  const [broken, setBroken] = useState(false)
  const src = p.avatar && !broken ? p.avatar : p.blockie
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`inline-block shrink-0 rounded-full object-cover ring-2 ring-grape-700 ${className}`}
      style={{ width: size, height: size, imageRendering: p.avatar && !broken ? undefined : 'pixelated' }}
    />
  )
}

/** Profile picture plus ENS name (or the short address). Used wherever a player's address shows. */
export function PlayerPill({ address, size = 16, className = '', nameClass = '' }: { address?: string | null; size?: number; className?: string; nameClass?: string }) {
  const p = useProfile(address)
  if (!address) return null
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 align-middle ${className}`} title={p.name ? `${p.name} (${address})` : address}>
      <ProfileAvatar address={address} size={size} />
      <span className={`truncate ${p.name ? 'font-bold text-cream-100' : ''} ${nameClass}`}>{p.label}</span>
    </span>
  )
}
