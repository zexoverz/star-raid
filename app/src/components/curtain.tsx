import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Phase } from '../lib/phase'
import { play } from '../lib/sfx'
import type { Frame } from '../lib/types'
import { Sprite } from './game'
import { CrewRow, Guide } from './mascots'

/**
 * The draw moment. When the window closes the curtain falls while Pyth Entropy draws the end block.
 * When the end block lands, the curtain parts to reveal it. Only plays live (not on page load of an
 * already-settled raid), and can be replayed from the results card.
 */
export function DrawCurtain({ frame, phase, replay, onDone }: { frame: Frame; phase: Phase; replay: number; onDone?: () => void }) {
  const [stage, setStage] = useState<'hidden' | 'closed' | 'reveal'>('hidden')
  const prevPhase = useRef<Phase | null>(null)
  const end = frame.endBlock

  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = phase
    if (prev === null) return
    const wasLive = prev === 'live' || prev === 'danger' || prev === 'upcoming'
    if (wasLive && (phase === 'drawing' || phase === 'revealed' || phase === 'victory' || phase === 'defeat')) {
      setStage('closed')
      play('drum')
    }
  }, [phase])

  useEffect(() => {
    if (stage === 'closed' && end) {
      const t = setTimeout(() => {
        setStage('reveal')
        play('reveal')
      }, 1600)
      return () => clearTimeout(t)
    }
  }, [stage, end])

  useEffect(() => {
    if (replay > 0) {
      setStage('closed')
      play('drum')
    }
  }, [replay])

  useEffect(() => {
    if (stage === 'reveal') {
      const t = setTimeout(() => {
        setStage('hidden')
        onDone?.()
      }, 3800)
      return () => clearTimeout(t)
    }
  }, [stage, onDone])

  return (
    <AnimatePresence>
      {stage !== 'hidden' && (
        <motion.div className="fixed inset-0 z-50 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <img src="/art/spotlight_stage.webp" onError={(e) => ((e.target as HTMLImageElement).src = '/art/raid_bg.webp')} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-grape-950/50" />

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {stage === 'reveal' && end ? (
              <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.5 }}>
                <Sprite name="victory_burst" className="absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow opacity-60" />
                <Sprite name="dice_block" className="mx-auto h-28 w-28" />
                <div className="title-outline mt-2 text-3xl text-candy-300">The end block is</div>
                <div className="title-outline text-7xl text-ember-400 sm:text-8xl">{Number(end).toLocaleString()}</div>
                <p className="mx-auto mt-4 max-w-md text-lg text-cream-100">Every hit at or before this block counts. Hits after it still keep what they bought, but earn no prize.</p>
              </motion.div>
            ) : (
              <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }}>
                <motion.div animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.05, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  <Sprite name="orb" className="mx-auto h-40 w-40" />
                </motion.div>
                <div className="title-outline mt-3 text-5xl">Drawing the end…</div>
                <p className="mt-3 text-cream-100/90">Pyth Entropy is picking a block inside the danger zone. Nobody, not even us, knows it yet.</p>
                <div className="mt-6">
                  <CrewRow size="h-24" pose="watch" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Two curtain halves: closed they meet in the middle and cover the whole screen; on reveal
              the left one slides out to the left and the right one out to the right. The motion
              wrapper does the slide, the inner image does the mirroring, so transforms never clash. */}
          <motion.div
            className="absolute inset-y-0 left-0 z-20 w-[51%] overflow-hidden shadow-[12px_0_30px_rgba(0,0,0,0.5)]"
            initial={{ x: '-100%' }}
            animate={{ x: stage === 'reveal' ? '-100%' : '0%' }}
            transition={{ duration: stage === 'reveal' ? 1.2 : 0.8, ease: [0.7, 0, 0.3, 1], delay: stage === 'reveal' ? 0.2 : 0 }}
          >
            <img src="/art/curtain.webp" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/40 to-transparent" />
          </motion.div>
          <motion.div
            className="absolute inset-y-0 right-0 z-20 w-[51%] overflow-hidden shadow-[-12px_0_30px_rgba(0,0,0,0.5)]"
            initial={{ x: '100%' }}
            animate={{ x: stage === 'reveal' ? '100%' : '0%' }}
            transition={{ duration: stage === 'reveal' ? 1.2 : 0.8, ease: [0.7, 0, 0.3, 1], delay: stage === 'reveal' ? 0.2 : 0 }}
          >
            <img src="/art/curtain.webp" alt="" className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/40 to-transparent" />
          </motion.div>
          {/* valance across the top */}
          <div className="absolute inset-x-0 top-0 z-30 h-16 bg-gradient-to-b from-[#2d2250] via-[#4a4373] to-transparent" />
          {stage === 'closed' && (
            <motion.div className="absolute inset-x-0 bottom-10 z-30 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              <div className="mb-2 flex justify-center">
                <Guide who="bunny" pose="watch" size="h-28">Shh… the curtain's closed. Pyth is rolling the end block!</Guide>
              </div>
              <div className="title-outline text-4xl">Drawing the end…</div>
              <motion.div className="mx-auto mt-3 h-2 w-56 overflow-hidden rounded-full bg-grape-950/70">
                <motion.div className="h-full bg-ember-400" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
              </motion.div>
            </motion.div>
          )}
          <button className="btn btn-ghost absolute right-4 top-20 z-40 px-4 py-2 text-xs" onClick={() => setStage('hidden')}>
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
