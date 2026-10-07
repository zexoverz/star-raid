import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { starArt } from '../lib/stars'

export function StarAvatar({ tokenId, size = 56, ring = true, dim = false, className = '' }: { tokenId: string | null; size?: number; ring?: boolean; dim?: boolean; className?: string }) {
  const art = starArt(tokenId)
  if (!art) return <BotAvatar size={size} className={className} />
  return (
    <div
      className={`relative shrink-0 rounded-full ${art.legendary ? 'animate-pulse-glow' : ''} ${className}`}
      style={{ width: size, height: size }}
      title={`Lil Star #${tokenId}`}
    >
      <img
        src={art.src}
        onError={(e) => {
          const img = e.currentTarget
          if (!img.src.endsWith(art.fallback)) img.src = art.fallback
        }}
        alt={`Lil Star #${tokenId}`}
        loading="lazy"
        className={`h-full w-full rounded-full object-cover ${dim ? 'grayscale opacity-50' : ''}`}
        style={{
          boxShadow: ring ? `0 0 0 3px ${art.legendary ? '#ffd27a' : '#2d2250'}, 0 0 0 ${art.legendary ? 6 : 5}px ${art.legendary ? '#ff8c42' : '#7a6eb2'}` : undefined,
        }}
      />
      {art.legendary && <span className="absolute -top-2 -right-1 text-sm drop-shadow">👑</span>}
    </div>
  )
}

export function BotAvatar({ size = 56, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`relative shrink-0 grid place-items-center rounded-full bg-grape-900 ${className}`} style={{ width: size, height: size, boxShadow: '0 0 0 3px #2d2250, 0 0 0 5px #4a4373' }} title="No seat: went through, counts for nothing">
      <img src="/art/bot.webp" alt="" className="h-[86%] w-[86%] object-contain opacity-80" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
    </div>
  )
}

/** A chunky game progress bar. `value` 0..1. */
export function GameBar({
  value,
  tone = 'ember',
  height = 28,
  tentative = false,
  marker,
  children,
}: {
  value: number
  tone?: 'ember' | 'candy' | 'mint' | 'boss'
  height?: number
  tentative?: boolean
  marker?: number
  children?: ReactNode
}) {
  const v = Math.min(Math.max(value, 0), 1)
  const fills: Record<string, string> = {
    ember: 'linear-gradient(180deg,#ffd27a,#ff8c42 55%,#fd6b10)',
    candy: 'linear-gradient(180deg,#ff8de0,#e826b1 60%,#aa3686)',
    mint: 'linear-gradient(180deg,#d6ffe9,#a3e3c1 55%,#4fb487)',
    boss: 'linear-gradient(180deg,#ff6b8a,#e8264f 55%,#a3123a)',
  }
  return (
    <div className="relative w-full rounded-full p-[4px]" style={{ height, background: '#15122a', boxShadow: '0 0 0 3px #7a6eb2, 0 4px 0 #2d2250' }}>
      <div className="relative h-full w-full overflow-hidden rounded-full bg-grape-800">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${tentative ? 'tentative' : 'firm'}`}
          style={{ background: fills[tone] }}
          initial={false}
          animate={{ width: `${v * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          <div className="bar-stripes absolute inset-0 rounded-full" />
          <div className="absolute inset-x-2 top-[3px] h-[30%] rounded-full bg-white/35" />
        </motion.div>
        {marker !== undefined && <div className="absolute inset-y-0 w-[3px] bg-white/80" style={{ left: `calc(${Math.min(marker, 1) * 100}% - 1px)` }} />}
        {children && <div className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold tracking-wide text-white [text-shadow:0_1px_0_#2d2250,0_0_6px_#2d2250]">{children}</div>}
      </div>
    </div>
  )
}

export function Sprite({ name, className = '', alt = '' }: { name: string; className?: string; alt?: string }) {
  return <img src={`/art/${name}.webp`} alt={alt} draggable={false} className={`pointer-events-none select-none ${className}`} />
}

export function Twinkles({ count = 18 }: { count?: number }) {
  const stars = Array.from({ length: count }, (_, i) => ({
    left: (i * 53) % 100,
    top: (i * 37) % 70,
    delay: (i % 7) * 0.35,
    size: 6 + (i % 4) * 4,
  }))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <span key={i} className="absolute animate-twinkle text-ember-300" style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s`, fontSize: s.size }}>
          ✦
        </span>
      ))}
    </div>
  )
}

export function Stat({ label, value, sub, tentative, icon }: { label: string; value: ReactNode; sub?: ReactNode; tentative?: boolean; icon?: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <Sprite name={icon} className="h-11 w-11 object-contain drop-shadow-[0_3px_0_#2d2250]" />}
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-grape-300">{label}</div>
        <div className={`font-display text-2xl leading-tight text-white ${tentative ? 'tentative' : 'firm'}`}>{value}</div>
        {sub && <div className="text-xs text-grape-300">{sub}</div>}
      </div>
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel p-5 ${className}`}>{children}</div>
}

export function Ribbon({ children, color = '#e826b1' }: { children: ReactNode; color?: string }) {
  return (
    <div className="relative inline-block px-6 py-1.5 font-display text-lg text-white" style={{ background: color, clipPath: 'polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)', boxShadow: '0 4px 0 #2d2250' }}>
      {children}
    </div>
  )
}
