// Voiceover: one mp3 per line in src/explainer/vo.json (edge-tts), plus their lengths in
// src/explainer/vo-durations.json so each scene is timed to its line. Needs `edge-tts` on PATH
// (pip install edge-tts) or EDGE_TTS=/path/to/edge-tts. Swap in a human take by dropping
// public/audio/vo/<id>.mp3 with the same names and rerunning with --durations-only.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const VOICE = process.env.VOICE ?? 'en-US-AndrewNeural'
const RATE = process.env.RATE ?? '+4%'
const BIN = process.env.EDGE_TTS ?? 'edge-tts'
const root = new URL('../', import.meta.url).pathname
const lines = JSON.parse(readFileSync(`${root}src/explainer/vo.json`, 'utf8'))
const only = process.argv.includes('--durations-only')
mkdirSync(`${root}public/audio/vo`, { recursive: true })

const out = {}
for (const { id, text } of lines) {
  const mp3 = `${root}public/audio/vo/${id}.mp3`
  if (!only) execFileSync(BIN, ['--voice', VOICE, `--rate=${RATE}`, '--text', text, '--write-media', mp3], { stdio: 'inherit' })
  const sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim())
  out[id] = Math.round(sec * 1000) / 1000
  console.log(`${id.padEnd(8)} ${sec.toFixed(1)} s`)
}
writeFileSync(`${root}src/explainer/vo-durations.json`, JSON.stringify(out, null, 2) + '\n')
console.log(`total ${Object.values(out).reduce((a, b) => a + b, 0).toFixed(1)} s`)
