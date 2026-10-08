/**
 * Background music. Off by default (browsers block autoplay anyway); the 🎵 button in the top bar
 * turns it on, remembered in localStorage. Three chiptune battle loops (ElevenLabs, ~30 s each)
 * play as a rotating playlist so the same loop never repeats back to back. During a live raid the
 * mix gets louder (`setIntensity('raid')`); everywhere else it sits quietly under the UI.
 */
const TRACKS = ['/music/raid-1.mp3', '/music/raid-2.mp3', '/music/raid-3.mp3']
const VOLUME = { calm: 0.22, raid: 0.42 } as const
type Intensity = keyof typeof VOLUME

let enabled = typeof localStorage !== 'undefined' && localStorage.getItem('sr-music') === 'on'
let intensity: Intensity = 'calm'
let index = Math.floor(Math.random() * TRACKS.length)
let audio: HTMLAudioElement | null = null
let fade: ReturnType<typeof setInterval> | undefined
let waitingForTap = false
const listeners = new Set<(on: boolean) => void>()

export const musicOn = () => enabled
/** For checks and debugging: what is playing and how loud. */
export const musicState = () => ({ enabled, intensity, playing: !!audio && !audio.paused, volume: audio?.volume ?? 0, src: audio?.src ?? '' })
if (typeof window !== 'undefined') (window as unknown as { __music?: typeof musicState }).__music = musicState
export function onMusic(l: (on: boolean) => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function el() {
  if (audio) return audio
  audio = new Audio(TRACKS[index])
  audio.preload = 'auto'
  audio.volume = 0
  // next loop in the playlist when one ends (each file is a seamless ~30 s loop)
  audio.addEventListener('ended', () => {
    index = (index + 1) % TRACKS.length
    audio!.src = TRACKS[index]
    void start()
  })
  return audio
}

function rampTo(target: number, ms = 600, then?: () => void) {
  const a = el()
  clearInterval(fade)
  const from = a.volume
  const steps = Math.max(1, Math.round(ms / 40))
  let i = 0
  fade = setInterval(() => {
    i++
    a.volume = Math.min(1, Math.max(0, from + ((target - from) * i) / steps))
    if (i >= steps) {
      clearInterval(fade)
      then?.()
    }
  }, 40)
}

async function start() {
  if (!enabled || document.hidden) return
  const a = el()
  try {
    await a.play()
    waitingForTap = false
    rampTo(VOLUME[intensity], 800)
  } catch {
    // blocked until the next user gesture
    if (!waitingForTap) {
      waitingForTap = true
      window.addEventListener('pointerdown', () => void start(), { once: true })
    }
  }
}

export function setMusic(on: boolean) {
  enabled = on
  try {
    localStorage.setItem('sr-music', on ? 'on' : 'off')
  } catch {
    /* private mode */
  }
  if (on) void start()
  else if (audio) rampTo(0, 400, () => audio?.pause())
  listeners.forEach((l) => l(on))
}

/** Louder while a raid window is open, calmer everywhere else. */
export function setIntensity(next: Intensity) {
  if (next === intensity) return
  intensity = next
  if (enabled && audio && !audio.paused) rampTo(VOLUME[next], 900)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!audio) return
    if (document.hidden) audio.pause()
    else if (enabled) void start()
  })
  if (enabled) {
    // autoplay is blocked on load; start on the first tap anywhere
    waitingForTap = true
    window.addEventListener('pointerdown', () => void start(), { once: true })
  }
}
