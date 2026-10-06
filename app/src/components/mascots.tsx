import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Official Lil Stars mascots (animated art from lilstars.xyz, resized only). We never redraw or
 * alter them: we only place them, move them around and give them speech bubbles.
 */
export type Who = 'fox' | 'chog' | 'bunny' | 'bear'

export const CREW: Record<Who, { name: string; src: string; still: string; color: string; back?: string }> = {
  fox: { name: 'Foxstar', src: '/art/lilstars/fox.webp', still: '/art/lilstars/LilFox.webp', color: '#F7C873', back: '/art/lilstars/fox_back.webp' },
  chog: { name: 'Chogstar', src: '/art/lilstars/chog.webp', still: '/art/lilstars/Chogstar.webp', color: '#A3E3C1' },
  bunny: { name: 'Bunnystar', src: '/art/lilstars/bunny.webp', still: '/art/lilstars/LilBunny.webp', color: '#F7B2D9' },
  bear: { name: 'Bearstar', src: '/art/lilstars/bear.webp', still: '/art/lilstars/LilMouse.webp', color: '#B6D6F7' },
}

export function Mascot({ who, className = '', still = false, back = false }: { who: Who; className?: string; still?: boolean; back?: boolean }) {
  const c = CREW[who]
  const src = back && c.back ? c.back : still ? c.still : c.src
  return <img src={src} alt={c.name} draggable={false} className={`pointer-events-none select-none object-contain ${className}`} />
}

/** A mascot that talks. The bubble text is copy we write; the character is untouched. */
export function Guide({ who, children, side = 'right', size = 'h-28', className = '' }: { who: Who; children: ReactNode; side?: 'left' | 'right'; size?: string; className?: string }) {
  const c = CREW[who]
  return (
    <div className={`flex items-end gap-2 ${side === 'left' ? 'flex-row-reverse' : ''} ${className}`}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="shrink-0">
        <Mascot who={who} className={`${size} w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,0.35)]`} />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div
          key={String(children)}
          initial={{ scale: 0.6, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className={`relative mb-8 max-w-xs rounded-3xl border-[3px] bg-cream-100 px-4 py-2.5 font-fun text-[15px] font-bold leading-snug text-grape-900 shadow-[0_4px_0_#2d2250] ${side === 'left' ? 'origin-bottom-right' : 'origin-bottom-left'}`}
          style={{ borderColor: c.color }}
        >
          <div className="mb-0.5 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#665D96' }}>
            {c.name}
          </div>
          {children}
          <span className={`absolute -bottom-[11px] h-5 w-5 rotate-45 border-b-[3px] border-r-[3px] bg-cream-100 ${side === 'left' ? 'right-6' : 'left-6'}`} style={{ borderColor: c.color }} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * The crew on stage, facing the wall. `hitTick` changes on every new buy: they hop. `mood` swaps the
 * whole party into celebrate / gloomy poses (by motion only, the art stays the same).
 */
export function StageCrew({ hitTick, mood }: { hitTick: number; mood: 'fight' | 'cheer' | 'gloom' | 'wait' }) {
  const order: Who[] = ['bunny', 'chog', 'fox', 'bear']
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-2 sm:px-8">
      {order.map((w, i) => {
        const left = i < 2
        const hop = mood === 'fight' ? { y: [0, -26, 0], rotate: [0, left ? 8 : -8, 0] } : mood === 'cheer' ? { y: [0, -34, 0], rotate: [0, -6, 6, 0] } : mood === 'gloom' ? { y: 4, rotate: left ? -4 : 4 } : { y: [0, -4, 0] }
        return (
          <motion.div
            key={`${w}-${mood === 'fight' ? hitTick : mood}`}
            className={`${i === 1 || i === 2 ? 'hidden sm:block' : ''}`}
            initial={false}
            animate={hop}
            transition={mood === 'cheer' ? { duration: 0.6, repeat: Infinity, delay: i * 0.12 } : mood === 'wait' ? { duration: 2.4, repeat: Infinity, delay: i * 0.3 } : { duration: 0.45, delay: i * 0.05 }}
          >
            <Mascot who={w} className={`h-24 w-auto sm:h-32 drop-shadow-[0_8px_6px_rgba(0,0,0,0.45)] ${mood === 'gloom' ? 'opacity-80' : ''}`} />
          </motion.div>
        )
      })}
    </div>
  )
}

/** A tiny crew row for headers and empty states. */
export function CrewRow({ size = 'h-20', animate = true }: { size?: string; animate?: boolean }) {
  return (
    <div className="flex items-end justify-center gap-1">
      {(['chog', 'bunny', 'fox', 'bear'] as Who[]).map((w, i) => (
        <motion.div key={w} animate={animate ? { y: [0, -6, 0] } : {}} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}>
          <Mascot who={w} className={`${size} w-auto drop-shadow-[0_4px_4px_rgba(0,0,0,0.35)]`} />
        </motion.div>
      ))}
    </div>
  )
}
