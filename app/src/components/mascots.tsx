import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * The Lil Stars crew in Star Raid event poses and raid outfits (purple cape, orange scarf, pink
 * headband). Event art generated on-model from the official Lil Stars characters, approved by the
 * user on 6 Oct (decisions.md D35). The official idle art is kept as a fallback.
 */
export type Who = 'fox' | 'chog' | 'bunny' | 'bear'
export type Pose = 'attack' | 'cheer' | 'sad' | 'think' | 'watch' | 'wait' | 'idle'

export const CREW: Record<Who, { name: string; color: string }> = {
  fox: { name: 'Foxstar', color: '#F7C873' },
  chog: { name: 'Chogstar', color: '#A3E3C1' },
  bunny: { name: 'Bunnystar', color: '#F7B2D9' },
  bear: { name: 'Bearstar', color: '#B6D6F7' },
}

/** Which event poses exist; anything else falls back to the closest one, then to official idle. */
const POSES: Record<Who, Partial<Record<Pose, string>>> = {
  fox: { attack: 'fox_attack', cheer: 'fox_cheer', think: 'fox_think', idle: 'fox_think', wait: 'fox_think', watch: 'fox_think', sad: 'fox_think' },
  chog: { attack: 'chog_attack', cheer: 'chog_cheer', wait: 'chog_wait', idle: 'chog_wait', think: 'chog_wait', watch: 'chog_wait', sad: 'chog_wait' },
  bunny: { attack: 'bunny_attack', cheer: 'bunny_cheer', watch: 'bunny_watch', idle: 'bunny_cheer', think: 'bunny_cheer', wait: 'bunny_watch', sad: 'bunny_watch' },
  bear: { attack: 'bear_attack', cheer: 'bear_cheer', sad: 'bear_sad', idle: 'bear_cheer', think: 'bear_attack', wait: 'bear_attack', watch: 'bear_sad' },
}
const OFFICIAL: Record<Who, string> = { fox: '/art/lilstars/fox.webp', chog: '/art/lilstars/chog.webp', bunny: '/art/lilstars/bunny.webp', bear: '/art/lilstars/bear.webp' }

export function poseSrc(who: Who, pose: Pose) {
  const p = POSES[who][pose]
  return p ? `/art/crew/${p}.webp` : OFFICIAL[who]
}

export function Mascot({ who, pose = 'idle', className = '' }: { who: Who; pose?: Pose; className?: string }) {
  return (
    <img
      src={poseSrc(who, pose)}
      onError={(e) => ((e.target as HTMLImageElement).src = OFFICIAL[who])}
      alt={CREW[who].name}
      draggable={false}
      className={`pointer-events-none select-none object-contain ${className}`}
    />
  )
}

/** A mascot that talks. The bubble re-animates only when `bubbleKey` (default: the text) changes, so
 *  never put a ticking value in the text; show counters outside the bubble. */
export function Guide({ who, pose = 'think', children, side = 'right', size = 'h-28', className = '', bubbleKey }: { who: Who; pose?: Pose; children: ReactNode; side?: 'left' | 'right'; size?: string; className?: string; bubbleKey?: string }) {
  const c = CREW[who]
  return (
    <div className={`flex items-end gap-2 ${side === 'left' ? 'flex-row-reverse' : ''} ${className}`}>
      <motion.div key={pose} initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="shrink-0">
        <Mascot who={who} pose={pose} className={`${size} w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,0.35)]`} />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div
          key={bubbleKey ?? String(children)}
          initial={{ scale: 0.6, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className={`relative mb-6 max-w-xs rounded-3xl border-[3px] bg-cream-100 px-4 py-2.5 text-[14px] font-semibold leading-snug text-grape-900 shadow-[0_4px_0_#2d2250] ${side === 'left' ? 'origin-bottom-right' : 'origin-bottom-left'}`}
          style={{ borderColor: c.color }}
        >
          <div className="mb-0.5 font-display text-[12px] uppercase tracking-widest text-grape-600">{c.name}</div>
          {children}
          <span className={`absolute -bottom-[11px] h-5 w-5 rotate-45 border-b-[3px] border-r-[3px] bg-cream-100 ${side === 'left' ? 'right-6' : 'left-6'}`} style={{ borderColor: c.color }} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export type CrewMood = 'fight' | 'cheer' | 'gloom' | 'wait' | 'watch'
const MOOD_POSE: Record<CrewMood, Record<Who, Pose>> = {
  fight: { fox: 'attack', chog: 'attack', bunny: 'attack', bear: 'attack' },
  cheer: { fox: 'cheer', chog: 'cheer', bunny: 'cheer', bear: 'cheer' },
  gloom: { fox: 'think', chog: 'wait', bunny: 'watch', bear: 'sad' },
  wait: { fox: 'think', chog: 'wait', bunny: 'watch', bear: 'attack' },
  watch: { fox: 'think', chog: 'wait', bunny: 'watch', bear: 'sad' },
}

/** The crew on stage, facing the wall. They lunge on every new hit (`hitTick`). */
export function StageCrew({ hitTick, mood }: { hitTick: number; mood: CrewMood }) {
  const order: Who[] = ['bear', 'chog', 'fox', 'bunny']
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-2 sm:px-6">
      {order.map((w, i) => {
        const left = i < 2
        const anim =
          mood === 'fight'
            ? { x: [0, left ? 28 : -28, 0], y: [0, -20, 0] }
            : mood === 'cheer'
              ? { y: [0, -30, 0] }
              : mood === 'gloom'
                ? { y: 4 }
                : { y: [0, -4, 0] }
        return (
          <motion.div
            key={`${w}-${mood === 'fight' ? hitTick : mood}`}
            className={`${i === 1 || i === 2 ? 'hidden sm:block' : ''}`}
            initial={false}
            animate={anim}
            transition={mood === 'cheer' ? { duration: 0.6, repeat: Infinity, delay: i * 0.12 } : mood === 'fight' ? { duration: 0.45, delay: i * 0.05 } : { duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
          >
            {/* Attack poses face right; the right-hand pair faces the wall from the other side. */}
            <div style={{ transform: !left && mood === 'fight' ? 'scaleX(-1)' : undefined }}>
              <Mascot who={w} pose={MOOD_POSE[mood][w]} className="h-24 w-auto drop-shadow-[0_8px_6px_rgba(0,0,0,0.45)] sm:h-36" />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/** A crew row for headers, empty states and celebrations. */
export function CrewRow({ size = 'h-20', pose = 'idle', animate = true }: { size?: string; pose?: Pose; animate?: boolean }) {
  return (
    <div className="flex items-end justify-center gap-1">
      {(['chog', 'bunny', 'fox', 'bear'] as Who[]).map((w, i) => (
        <motion.div key={w} animate={animate ? { y: [0, pose === 'cheer' ? -16 : -6, 0] } : {}} transition={{ duration: pose === 'cheer' ? 0.7 : 1.8, repeat: Infinity, delay: i * 0.15 }}>
          <Mascot who={w} pose={pose} className={`${size} w-auto drop-shadow-[0_4px_4px_rgba(0,0,0,0.35)]`} />
        </motion.div>
      ))}
    </div>
  )
}
