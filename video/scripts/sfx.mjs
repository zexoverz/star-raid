// Renders the app's synthesized sound kit (app/src/lib/sfx.ts) to WAV files for the video.
// Same oscillators, frequencies and envelopes, so the video sounds like the app. Run: pnpm sfx
import { mkdirSync, writeFileSync } from 'node:fs'

const RATE = 44100
const OUT = new URL('../public/audio/sfx/', import.meta.url)

function buffer(sec) {
  return new Float32Array(Math.ceil(sec * RATE))
}
const wave = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
}
// tone(freq, dur, type, gain, delay, slideTo), exponential attack 10 ms then exponential decay
function tone(b, freq, dur, type = 'triangle', gain = 0.12, delay = 0, slideTo) {
  let phase = 0
  const n = Math.floor(dur * RATE)
  const start = Math.floor(delay * RATE)
  for (let i = 0; i < n && start + i < b.length; i++) {
    const t = i / RATE
    const f = slideTo ? freq * Math.pow(slideTo / freq, t / dur) : freq
    phase += f / RATE
    const env = t < 0.01 ? Math.pow(gain / 0.0001, t / 0.01) * 0.0001 : gain * Math.pow(0.0001 / gain, (t - 0.01) / (dur - 0.01))
    b[start + i] += wave[type](phase) * env
  }
}
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
function noise(b, dur, gain = 0.08, delay = 0) {
  const n = Math.floor(dur * RATE)
  const start = Math.floor(delay * RATE)
  for (let i = 0; i < n && start + i < b.length; i++) b[start + i] += rnd() * (1 - i / n) * gain
}

const KIT = {
  hit: [0.3, (b) => (noise(b, 0.12, 0.12), tone(b, 220, 0.14, 'square', 0.08, 0, 90))],
  combo: [0.5, (b) => [523, 659, 784, 1047].forEach((f, i) => tone(b, f, 0.12, 'triangle', 0.1, i * 0.06))],
  join: [0.35, (b) => (tone(b, 660, 0.1, 'sine', 0.12), tone(b, 990, 0.16, 'sine', 0.1, 0.08))],
  tick: [0.1, (b) => tone(b, 1200, 0.04, 'square', 0.04)],
  drum: [1.0, (b) => { for (let i = 0; i < 10; i++) noise(b, 0.05, 0.05 + i * 0.008, i * 0.09) }],
  reveal: [0.9, (b) => (tone(b, 392, 0.2, 'triangle', 0.12), tone(b, 523, 0.2, 'triangle', 0.12, 0.12), tone(b, 784, 0.5, 'triangle', 0.14, 0.24))],
  victory: [1.5, (b) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(b, f, i === 6 ? 0.6 : 0.14, 'triangle', 0.12, i * 0.11))],
  defeat: [1.0, (b) => [392, 349, 311, 262].forEach((f, i) => tone(b, f, 0.3, 'sine', 0.1, i * 0.18))],
  click: [0.1, (b) => tone(b, 880, 0.05, 'sine', 0.06)],
  coin: [0.45, (b) => (tone(b, 988, 0.08, 'square', 0.07), tone(b, 1319, 0.3, 'square', 0.07, 0.07))],
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s * 2.2)) * 32767, i * 2))
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

mkdirSync(OUT, { recursive: true })
for (const [name, [sec, fn]] of Object.entries(KIT)) {
  const b = buffer(sec)
  fn(b)
  writeFileSync(new URL(`${name}.wav`, OUT), wav(b))
}
console.log(`wrote ${Object.keys(KIT).length} sounds to public/audio/sfx/`)
