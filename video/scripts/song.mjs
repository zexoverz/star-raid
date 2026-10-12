// Generate the sung demo track with ElevenLabs Music from src/song/plan.json (music_v1 composition plan,
// so each section lands at a known time and the video can follow it).
//   node scripts/song.mjs            -> public/audio/song/star-raid-song.mp3 (+ .json with song id)
// The key is read from ELEVENLABS_API_KEY or ~/.config/elevenlabs/key; never committed (rule 14).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const root = new URL('../', import.meta.url).pathname
const KEY = process.env.ELEVENLABS_API_KEY ?? (existsSync(`${homedir()}/.config/elevenlabs/key`) ? readFileSync(`${homedir()}/.config/elevenlabs/key`, 'utf8').trim() : '')
if (!KEY) throw new Error('No ElevenLabs key (ELEVENLABS_API_KEY or ~/.config/elevenlabs/key).')
const plan = JSON.parse(readFileSync(`${root}src/song/plan.json`, 'utf8'))
const out = `${root}public/audio/song`
mkdirSync(out, { recursive: true })
const tag = process.argv[2] ?? 'star-raid-song'

const body = {
  model_id: plan.model,
  respect_sections_durations: true,
  composition_plan: {
    positive_global_styles: plan.positive_global_styles,
    negative_global_styles: plan.negative_global_styles,
    sections: plan.sections.map((s) => ({ section_name: s.section_name, positive_local_styles: s.positive_local_styles, negative_local_styles: s.negative_local_styles, duration_ms: s.duration_ms, lines: s.lines })),
  },
}
const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) })
if (!r.ok) throw new Error(`music ${r.status}: ${(await r.text()).slice(0, 400)}`)
const mp3 = Buffer.from(await r.arrayBuffer())
writeFileSync(`${out}/${tag}.mp3`, mp3)
writeFileSync(`${out}/${tag}.json`, JSON.stringify({ songId: r.headers.get('song-id'), sections: plan.sections.map((s) => ({ name: s.section_name, ms: s.duration_ms, lines: s.lines })) }, null, 2))
console.log(`${tag}.mp3 ${(mp3.length / 1024).toFixed(0)} KB, song id ${r.headers.get('song-id')}`)
