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
export function PlayerPill({ address, size = 16, className = '', nameClass = '', hideAvatar = false }: { address?: string | null; size?: number; className?: string; nameClass?: string; hideAvatar?: boolean }) {
  const p = useProfile(address)
  if (!address) return null
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 align-middle ${className}`} title={p.name ? `${p.name} (${address})` : address}>
      {!hideAvatar && <ProfileAvatar address={address} size={size} />}
      <span className={`truncate ${p.name ? 'font-bold text-cream-100' : ''} ${nameClass}`}>{p.label}</span>
    </span>
  )
}

/** Big round player avatar (party, hit log, podium, draw): ENS avatar or blockie, game ring, optional dim. */
export function PlayerAvatar({ address, size = 40, dim = false, ring = true, className = '' }: { address?: string | null; size?: number; dim?: boolean; ring?: boolean; className?: string }) {
  const p = useProfile(address)
  const [broken, setBroken] = useState(false)
  const src = p.avatar && !broken ? p.avatar : p.blockie
  if (!src) return <div className={`shrink-0 rounded-full bg-grape-800 ${className}`} style={{ width: size, height: size }} />
  return (
    <img
      src={src}
      alt={p.label}
      title={p.label}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full object-cover ${dim ? 'opacity-50 grayscale' : ''} ${className}`}
      style={{ width: size, height: size, imageRendering: p.avatar && !broken ? undefined : 'pixelated', boxShadow: ring ? '0 0 0 3px #2d2250, 0 0 0 5px #7a6eb2' : undefined }}
    />
  )
}
