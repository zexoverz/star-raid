/**
 * Tiny synthesized sound kit (WebAudio, no files). Off by default; the toggle lives in the top bar.
 * Sounds only ever react to what the chain showed: a buy landed, the end was drawn, the result.
 */
type Sfx = 'hit' | 'combo' | 'join' | 'tick' | 'drum' | 'reveal' | 'victory' | 'defeat' | 'click' | 'coin'

let ctx: AudioContext | null = null
let enabled = typeof localStorage !== 'undefined' && localStorage.getItem('sr-sound') === 'on'
const listeners = new Set<(on: boolean) => void>()

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
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
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

function noise(dur: number, gain = 0.08, delay = 0) {
  const c = ensure()
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = c.createBufferSource()
  const g = c.createGain()
  g.gain.value = gain
  s.buffer = buf
  s.connect(g).connect(c.destination)
  s.start(c.currentTime + delay)
}

export function play(s: Sfx) {
  if (!enabled) return
  try {
    switch (s) {
      case 'hit':
        noise(0.12, 0.12)
        tone(220, 0.14, 'square', 0.08, 0, 90)
        break
      case 'combo':
        ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, i * 0.06))
        break
      case 'join':
        tone(660, 0.1, 'sine', 0.12)
        tone(990, 0.16, 'sine', 0.1, 0.08)
        break
      case 'tick':
        tone(1200, 0.04, 'square', 0.04)
        break
      case 'drum':
        for (let i = 0; i < 10; i++) noise(0.05, 0.05 + i * 0.008, i * 0.09)
        break
      case 'reveal':
        tone(392, 0.2, 'triangle', 0.12)
        tone(523, 0.2, 'triangle', 0.12, 0.12)
        tone(784, 0.5, 'triangle', 0.14, 0.24)
        break
      case 'victory':
        ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.14, 'triangle', 0.12, i * 0.11))
        break
      case 'defeat':
        ;[392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, i * 0.18))
        break
      case 'click':
        tone(880, 0.05, 'sine', 0.06)
        break
      case 'coin':
        tone(988, 0.08, 'square', 0.07)
        tone(1319, 0.3, 'square', 0.07, 0.07)
        break
    }
  } catch {
    /* audio is decoration; never break the screen */
  }
}
