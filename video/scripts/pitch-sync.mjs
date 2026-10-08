// Times the pitch video from the boss's recordings, or from a placeholder voice until they exist.
//
//   node scripts/pitch-sync.mjs            # placeholder voice for missing clips, transcribe real ones
//
// For each section in src/pitch/lines.json:
// - public/face/<file> exists: its speech is transcribed (ElevenLabs speech to text, key from
//   ~/.config/elevenlabs/key or ELEVENLABS_API_KEY), the clip is trimmed to the speech, and the
//   subtitles are what he actually said, timed to the word.
// - otherwise: each line is read by a free placeholder voice (edge-tts) into public/pitch-vo/, so the
//   cut has the right length and pacing before the real takes arrive.
// Cue times (when a card or sticker pops) come from the scripted lines and are scaled to the take.
// Writes src/pitch/timing.json, which the Remotion composition reads.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const root = new URL('../', import.meta.url).pathname
const sections = JSON.parse(readFileSync(`${root}src/pitch/lines.json`, 'utf8'))
const VOICE = process.env.VOICE ?? 'en-US-AndrewNeural'
const EDGE = process.env.EDGE_TTS ?? 'edge-tts'
const LEAD = 0.35
const TAIL = 0.55
const GAP = 0.22
mkdirSync(`${root}public/pitch-vo`, { recursive: true })

const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const key = () => process.env.ELEVENLABS_API_KEY ?? (existsSync(`${homedir()}/.config/elevenlabs/key`) ? readFileSync(`${homedir()}/.config/elevenlabs/key`, 'utf8').trim() : '')

/** Placeholder: one mp3 per line (cached by text), joined with short gaps. Returns line starts. */
function placeholder(sec) {
  const parts = sec.lines.map((l) => {
    const text = l.say ?? l.t
    const h = createHash('sha1').update(VOICE + text).digest('hex').slice(0, 10)
    const f = `${root}public/pitch-vo/line-${h}.mp3`
    if (!existsSync(f)) execFileSync(EDGE, ['--voice', VOICE, '--rate=+2%', '--text', text, '--write-media', f], { stdio: 'ignore' })
    return { f, d: dur(f) }
  })
  const out = `${root}public/pitch-vo/${sec.id}.mp3`
  const list = `${root}public/pitch-vo/${sec.id}.txt`
  const gap = `${root}public/pitch-vo/gap.mp3`
  if (!existsSync(gap)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-t', String(GAP), '-i', 'anullsrc=r=24000:cl=mono', '-b:a', '48k', gap])
  writeFileSync(list, parts.flatMap((p, i) => [`file '${p.f}'`, ...(i < parts.length - 1 ? [`file '${gap}'`] : [])]).join('\n'))
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ar', '44100', '-b:a', '128k', out])
  let at = 0
  const lines = parts.map((p, i) => {
    const s = { t: sec.lines[i].t, start: at, end: at + p.d }
    at += p.d + GAP
    return s
  })
  return { media: `pitch-vo/${sec.id}.mp3`, video: false, speech: [0, at - GAP], lines, trim: 0, length: at - GAP }
}

/** Real take: transcribe, trim to the speech, subtitles from the words he said. */
async function real(sec, file, plan) {
  const k = key()
  const wav = `${root}public/pitch-vo/${sec.id}-stt.mp3`
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', wav])
  const length = dur(file)
  let words = []
  if (k) {
    for (const model of ['scribe_v1', 'scribe_v2']) {
      const form = new FormData()
      form.append('model_id', model)
      form.append('language_code', 'en')
      form.append('file', new Blob([readFileSync(wav)], { type: 'audio/mpeg' }), 'take.mp3')
      const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': k }, body: form })
      if (r.ok) {
        words = ((await r.json()).words ?? []).filter((w) => w.type === 'word')
        break
      }
      console.warn(`  ${sec.id}: speech to text ${model} ${r.status}`)
    }
  }
  if (!words.length) {
    console.warn(`  ${sec.id}: no transcript, using the script lines spread over the clip`)
    return { ...plan, media: `face/${sec.file}`, video: true, length, trim: 0, speech: [0, length], lines: plan.lines.map((l) => ({ ...l, start: (l.start / plan.length) * length, end: (l.end / plan.length) * length })) }
  }
  const s0 = words[0].start
  const s1 = words[words.length - 1].end
  const trim = Math.max(0, s0 - LEAD)
  const shift = (t) => t - trim
  // subtitles: what he said, in chunks of up to 9 words, split at sentence ends and pauses
  const subs = []
  let cur = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    cur.push(w)
    const next = words[i + 1]
    const pause = next ? next.start - w.end : 1
    if (/[.!?]$/.test(w.text) || cur.length >= 9 || pause > 0.6 || !next) {
      subs.push({ t: cur.map((x) => x.text).join(' ').replace(/\s+([,.!?])/g, '$1'), start: shift(cur[0].start), end: shift(cur[cur.length - 1].end) })
      cur = []
    }
  }
  // visual cues follow the scripted line positions, scaled to his speech span
  const k2 = (s1 - s0) / plan.length
  const cues = plan.lines.map((l) => shift(s0 + l.start * k2))
  return { media: `face/${sec.file}`, video: true, length: Math.min(length - trim, shift(s1) + TAIL), trim, speech: [shift(s0), shift(s1)], lines: subs, cues }
}

const out = []
for (const sec of sections) {
  if (!sec.lines) {
    out.push({ id: sec.id, face: sec.face, dur: sec.fixed, media: null, video: false, lines: [], cues: [] })
    console.log(`${sec.id.padEnd(8)} ${sec.fixed.toFixed(1)} s  (fixed)`)
    continue
  }
  const plan = placeholder(sec)
  const file = `${root}public/face/${sec.file}`
  const r = existsSync(file) ? await real(sec, file, plan) : plan
  const cues = r.cues ?? plan.lines.map((l) => l.start + LEAD)
  const lead = r.video ? 0 : LEAD
  const d = r.video ? r.length : LEAD + plan.length + TAIL
  out.push({
    id: sec.id,
    face: sec.face,
    dur: Math.round((d + (sec.endCard ?? 0)) * 100) / 100,
    talk: Math.round(d * 100) / 100,
    media: r.media,
    video: r.video,
    trim: r.trim ?? 0,
    lead,
    lines: r.lines.map((l) => ({ t: l.t, start: +(l.start + lead).toFixed(2), end: +(l.end + lead).toFixed(2) })),
    cues: cues.map((c) => +c.toFixed(2)),
  })
  console.log(`${sec.id.padEnd(8)} ${d.toFixed(1)} s  ${r.video ? `face/${sec.file}` : 'placeholder voice'}`)
}
writeFileSync(`${root}src/pitch/timing.json`, JSON.stringify(out, null, 2) + '\n')
console.log(`total ${out.reduce((a, s) => a + s.dur, 0).toFixed(1)} s`)
