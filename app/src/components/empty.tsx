import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Mascot, type Pose, type Who } from './mascots'

/**
 * Lil Stars empty states: a small staged scene (a crew member in an event pose with a prop on a
 * spotlight), a title and one line. Composed from the approved crew art and the event props, so
 * every "nothing here" moment still looks like the game.
 */
export type EmptyScene = 'no-raids' | 'no-wins' | 'no-live' | 'no-held' | 'no-hits' | 'no-seats' | 'no-star' | 'no-count' | 'no-recent'

const SCENES: Record<EmptyScene, { who: Who; pose: Pose; prop: string; tint: string }> = {
  'no-raids': { who: 'bear', pose: 'cheer', prop: 'flag_sponsor', tint: '#B6D6F7' },
  'no-recent': { who: 'fox', pose: 'think', prop: 'hourglass', tint: '#F7C873' },
  'no-wins': { who: 'fox', pose: 'attack', prop: 'trophy', tint: '#F7C873' },
  'no-live': { who: 'chog', pose: 'wait', prop: 'hourglass', tint: '#A3E3C1' },
  'no-held': { who: 'bunny', pose: 'cheer', prop: 'shield', tint: '#F7B2D9' },
  'no-hits': { who: 'fox', pose: 'attack', prop: 'hit_spark', tint: '#F7C873' },
  'no-seats': { who: 'chog', pose: 'wait', prop: 'seat_ticket', tint: '#A3E3C1' },
  'no-star': { who: 'bunny', pose: 'watch', prop: 'sparkle', tint: '#F7B2D9' },
  'no-count': { who: 'bear', pose: 'sad', prop: 'dice_block', tint: '#B6D6F7' },
}

export function EmptyState({ scene, title, children, action, size = 'md', className = '' }: { scene: EmptyScene; title: string; children?: ReactNode; action?: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = SCENES[scene]
  const big = size === 'lg'
  const small = size === 'sm'
  const mascotH = big ? 'h-44' : small ? 'h-20' : 'h-32'
  const propH = big ? 'h-24 w-24' : small ? 'h-11 w-11' : 'h-16 w-16'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`dashed-card relative flex overflow-hidden bg-grape-900/70 ${small ? 'items-center gap-3 p-3' : 'flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left'} ${big ? 'sm:p-10' : ''} ${className}`}
      style={{ ['--card-color' as string]: s.tint }}
    >
      {/* the little stage: a soft spotlight, the crew member and their prop */}
      <div className={`relative shrink-0 ${small ? '' : 'px-4'}`}>
        <div className="absolute inset-x-0 bottom-0 mx-auto h-1/3 rounded-[50%] opacity-50 blur-md" style={{ background: s.tint }} />
        <div className="relative flex items-end">
          <Mascot who={s.who} pose={s.pose} className={`${mascotH} w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)]`} />
          <motion.img
            src={`/art/${s.prop}.webp`}
            alt=""
            draggable={false}
            className={`${propH} -ml-3 object-contain drop-shadow-[0_4px_0_#15122a]`}
            animate={{ y: [0, -6, 0], rotate: [0, 4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-display text-white ${big ? 'text-3xl' : small ? 'text-base' : 'text-xl'}`}>{title}</div>
        {children && <div className={`mt-1 text-grape-300 ${small ? 'text-xs' : 'text-sm'}`}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </motion.div>
  )
}
