/**
 * Sound kit. Off by default; the toggle lives in the top bar.
 * Sounds only ever react to what the chain showed: a buy landed, the end was drawn, the result.
 *
 * Samples in /public/sfx (generated with ElevenLabs sound effects, soft cartoon game style) are
 * fetched and decoded once when sound is turned on, then played through WebAudio so rapid hits can
 * overlap. Until a sample is decoded (or if a fetch fails) the small synthesized fallback plays.
 */
export type Sfx = 'hit' | 'combo' | 'join' | 'tick' | 'drum' | 'reveal' | 'victory' | 'defeat' | 'click' | 'coin'
export const NAMES: Sfx[] = ['hit', 'combo', 'join', 'tick', 'drum', 'reveal', 'victory', 'defeat', 'click', 'coin']

/**
 * Which take to use per sound: 0 is the current /sfx/<name>.mp3, 1-3 is /sfx/takes/<name>-<n>.mp3
 * (cute kawaii takes, compare them on the hidden /sounds page). A missing take falls back to the
 * current file, then to the synth.
 */
export const PICKS: Record<Sfx, number> = {
  hit: 0,
  combo: 0,
  join: 0,
  tick: 0,
  drum: 0,
  reveal: 0,
  victory: 0,
  defeat: 0,
  click: 0,
  coin: 0,
}

export const sfxUrl = (n: Sfx, take = PICKS[n]) => (take ? `/sfx/takes/${n}-${take}.mp3` : `/sfx/${n}.mp3`)

/** Per-sound mix so UI clicks stay quiet and the big moments land. */
const MIX: Record<Sfx, { gain: number; vary?: number }> = {
  hit: { gain: 0.7, vary: 0.08 },
  combo: { gain: 0.6 },
  join: { gain: 0.55 },
  tick: { gain: 0.5 },
  drum: { gain: 0.7 },
  reveal: { gain: 0.7 },
  victory: { gain: 0.75 },
  defeat: { gain: 0.65 },
  click: { gain: 0.35, vary: 0.05 },
  coin: { gain: 0.5, vary: 0.04 },
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = typeof localStorage !== 'undefined' && localStorage.getItem('sr-sound') === 'on'
const listeners = new Set<(on: boolean) => void>()
const buffers = new Map<Sfx, AudioBuffer>()
let loading: Promise<void> | null = null

export const soundOn = () => enabled
export function setSound(on: boolean) {
  enabled = on
  localStorage.setItem('sr-sound', on ? 'on' : 'off')
  if (on) ensure()
  listeners.forEach((l) => l(on))
}
export function onSound(l: (on: boolean) => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function ensure() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  if (!loading) loading = preload(ctx)
  return ctx
}

async function preload(c: AudioContext) {
  await Promise.all(
    NAMES.map(async (n) => {
      for (const url of new Set([sfxUrl(n), sfxUrl(n, 0)])) {
        try {
          const r = await fetch(url)
          if (!r.ok) continue
          buffers.set(n, await c.decodeAudioData(await r.arrayBuffer()))
          return
        } catch {
          /* try the next file, else keep the synth fallback for this sound */
        }
      }
    }),
  )
}

function sample(s: Sfx) {
  const c = ensure()
  const buf = buffers.get(s)
  if (!buf || !master) return false
  const src = c.createBufferSource()
  const g = c.createGain()
  const { gain, vary = 0 } = MIX[s]
  src.buffer = buf
  // a little pitch variation so a burst of hits doesn't sound like a machine gun
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * vary
  g.gain.value = gain
  src.connect(g).connect(master)
  src.start()
  return true
}

function tone(freq: number, dur: number, type: OscillatorType = 'triangle', gain = 0.12, delay = 0, slideTo?: number) {
  const c = ensure()
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Soft fallback (sine/triangle only, no square waves) for the moment before samples decode. */
function synth(s: Sfx) {
  switch (s) {
    case 'hit':
      tone(180, 0.16, 'sine', 0.12, 0, 80)
      break
    case 'combo':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'sine', 0.08, i * 0.06))
      break
    case 'join':
      tone(660, 0.12, 'sine', 0.1)
      tone(990, 0.18, 'sine', 0.08, 0.08)
      break
    case 'tick':
      tone(1100, 0.04, 'sine', 0.04)
      break
    case 'drum':
      for (let i = 0; i < 10; i++) tone(140, 0.06, 'triangle', 0.04 + i * 0.006, i * 0.09)
      break
    case 'reveal':
      ;[392, 523, 784].forEach((f, i) => tone(f, i === 2 ? 0.5 : 0.2, 'sine', 0.1, i * 0.12))
      break
    case 'victory':
      ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.14, 'triangle', 0.09, i * 0.11))
      break
    case 'defeat':
      ;[392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.08, i * 0.18))
      break
    case 'click':
      tone(880, 0.05, 'sine', 0.05)
      break
    case 'coin':
      tone(988, 0.08, 'sine', 0.06)
      tone(1319, 0.25, 'sine', 0.06, 0.07)
      break
  }
}

export function play(s: Sfx) {
  if (!enabled) return
  try {
    if (!sample(s)) synth(s)
  } catch {
    /* audio is decoration; never break the screen */
  }
}
