import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { preloadAll } from '../lib/preload'

/** Seen this session: later visits in the same tab skip straight in (assets are in the HTTP cache). */
const SEEN = 'sr-loaded'
const TIPS = [
  'One Lil Star = one seat per raid.',
  'Hit early! The end block can land anywhere in the danger zone.',
  'Pyth Entropy draws the end. Nobody can snipe it.',
  'Tap 🎵 for battle music.',
  'Every HIT is a real buy on Kuru, capped at the wall price.',
]

/**
 * Game-style loading screen: waits for art, fonts and sounds before showing the app, so nothing pops
 * in mid-raid. The very first frame is the static splash in index.html (no JS needed); this takes
 * over with real progress and fades out. Capped so a slow network never traps anyone here.
 */
export function Loader({ children }: { children: ReactNode }) {
  const first = typeof sessionStorage === 'undefined' || !sessionStorage.getItem(SEEN)
  const [progress, setProgress] = useState(first ? 0 : 1)
  const [ready, setReady] = useState(!first)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  useEffect(() => {
    // the static splash in index.html is replaced by this component
    document.getElementById('boot-splash')?.remove()
    if (!first) return
    let alive = true
    const started = Date.now()
    void preloadAll((p) => alive && setProgress(p)).then(() => {
      // keep it up long enough to read, short enough not to annoy
      const wait = Math.max(0, 700 - (Date.now() - started))
      setTimeout(() => {
        if (!alive) return
        setProgress(1)
        try {
          sessionStorage.setItem(SEEN, '1')
        } catch {
          /* private mode */
        }
        setReady(true)
      }, wait)
    })
    return () => {
      alive = false
    }
  }, [first])

  return (
    <>
      {/* the app mounts underneath, so live data and the wallet load while the art does */}
      <div aria-hidden={!ready} inert={!ready}>
        {children}
      </div>
      <AnimatePresence>{!ready && <Splash progress={progress} tip={tip} key="splash" />}</AnimatePresence>
    </>
  )
}

function Splash({ progress, tip }: { progress: number; tip: string }) {
  const pct = Math.round(progress * 100)
  const crew = ['chog_cheer', 'bunny_cheer', 'fox_cheer', 'bear_cheer']
  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-grape-950 px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      role="progressbar"
      aria-label="Loading Star Raid"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgb(232 38 177 / 0.25), transparent 60%), radial-gradient(ellipse at 50% 110%, rgb(255 140 66 / 0.25), transparent 60%)' }} />
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <motion.img src="/art/wordmark.svg" alt="Star Raid" className="h-40 w-auto drop-shadow-[0_8px_0_#15122a] sm:h-48" initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }} draggable={false} />

        <div className="mt-4 flex h-24 items-end justify-center gap-1">
          {crew.map((c, i) => (
            <motion.img
              key={c}
              src={`/art/crew/${c}.webp`}
              alt=""
              className="h-20 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,0.4)]"
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
              onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
              draggable={false}
            />
          ))}
        </div>

        <div className="mt-5 w-full rounded-full p-[4px]" style={{ background: '#15122a', boxShadow: '0 0 0 3px #7a6eb2, 0 4px 0 #2d2250' }}>
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-grape-800">
            <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: 'linear-gradient(180deg,#ffd27a,#ff8c42 55%,#fd6b10)' }} animate={{ width: `${Math.max(6, pct)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
              <div className="bar-stripes absolute inset-0 rounded-full" />
              <div className="absolute inset-x-2 top-[3px] h-[30%] rounded-full bg-white/35" />
            </motion.div>
            <div className="absolute inset-0 grid place-items-center text-[13px] font-extrabold text-white [text-shadow:0_1px_0_#2d2250]">{pct < 100 ? `Loading the raid… ${pct}%` : 'Ready!'}</div>
          </div>
        </div>

        <p className="mt-4 min-h-10 text-center text-[14px] font-semibold text-grape-300">{tip}</p>
      </div>
    </motion.div>
  )
}
