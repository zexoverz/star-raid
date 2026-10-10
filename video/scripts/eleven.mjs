// Sound effects and music from ElevenLabs (text to sound effects, music). Replaces the synthesized
// 8-bit kit in public/audio/sfx with the same file names, so no scene changes are needed.
//
//   ELEVENLABS_API_KEY=... node scripts/eleven.mjs sfx            # all sound effects
//   ELEVENLABS_API_KEY=... node scripts/eleven.mjs sfx hit combo  # only some
//   ELEVENLABS_API_KEY=... node scripts/eleven.mjs music          # trailer + explainer beds
//
// The key is read from the environment only; never commit it (AGENTS rule 14).
import { mkdirSync, writeFileSync } from 'node:fs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('Set ELEVENLABS_API_KEY in your shell (not in a file in the repo).')
const root = new URL('../public/audio/', import.meta.url).pathname
// `sfx --out kit` writes into public/audio/kit (the pitch's kit) instead of public/audio/sfx
const outIdx = process.argv.indexOf('--out')
const OUTDIR = outIdx > 0 ? process.argv.splice(outIdx, 2)[1] : 'sfx'

// One style line keeps the whole kit coherent: soft, rounded, cartoon game UI, no chiptune.
const STYLE = 'polished mobile game UI sound, soft and rounded, warm, cartoon, high quality, clean, no 8-bit, no chiptune, no music'
const SFX = {
  hit: { text: `a punchy cartoon thump of a soft mallet hitting a brick wall, with a small sparkle, ${STYLE}`, duration: 0.7 },
  combo: { text: `quick rising sparkly chime arpeggio, magical combo streak, ${STYLE}`, duration: 1.0 },
  coin: { text: `bright coin pickup with a twinkle, reward collected, ${STYLE}`, duration: 0.8 },
  tick: { text: `tiny soft wooden tick, subtle UI click, ${STYLE}`, duration: 0.5 },
  click: { text: `gentle bubbly button press pop, ${STYLE}`, duration: 0.5 },
  join: { text: `friendly two-note welcome chime, player joined, ${STYLE}`, duration: 0.8 },
  drum: { text: `tense theatrical drum roll on a snare, building suspense, curtain about to open, ${STYLE}`, duration: 2.2 },
  reveal: { text: `magical reveal shimmer with a soft whoosh and a bell hit, big moment, ${STYLE}`, duration: 1.6 },
  victory: { text: `short triumphant victory fanfare jingle with brass and sparkles, cheerful, game win stinger`, duration: 3.0 },
  defeat: { text: `soft sad cartoon descending trombone wah wah, gentle game lose stinger`, duration: 2.0 },
  whoosh: { text: `quick soft swoosh for a scene transition, airy, ${STYLE}`, duration: 0.6 },
  pop: { text: `soft bubble pop as a speech bubble appears, ${STYLE}`, duration: 0.5 },
  // motion kit for the pitch: every element that enters or leaves gets one of these
  'slide-in': { text: `short bright airy swoosh of a card sliding onto the screen from the side, ends crisply, ${STYLE}`, duration: 0.5 },
  'slide-out': { text: `short soft descending swoosh of a card sliding away off the screen, ${STYLE}`, duration: 0.5 },
  card: { text: `crisp single playing card flick and snap onto a table, ${STYLE}`, duration: 0.5 },
  photo: { text: `a polaroid photo slapped onto a corkboard, light paper slap with tiny tape sound, ${STYLE}`, duration: 0.5 },
  boing: { text: `tiny bouncy cartoon boing as a sticker pops into place, ${STYLE}`, duration: 0.5 },
  stamp: { text: `satisfying rubber stamp thunk on paper, ${STYLE}`, duration: 0.5 },
  sparkle: { text: `quick glittery sparkle shimmer, holographic card shine, ${STYLE}`, duration: 0.7 },
  scribble: { text: `quick marker pen scribble on a whiteboard, ${STYLE}`, duration: 0.6 },
}

const MUSIC = {
  // the trailer is about 37 s, the explainer about 2:21; the bed sits under the voiceover
  trailer: {
    ms: 38_000,
    prompt:
      'Upbeat playful orchestral-pop game trailer music, cheerful cartoon adventure, pizzicato strings, marimba, glockenspiel, light drums and claps, builds to a big triumphant finish around 25 seconds, then a short happy outro. Instrumental, no vocals, no chiptune.',
  },
  explainer: {
    ms: 145_000,
    prompt:
      'Light, friendly background music for a product walkthrough of a cozy cartoon game: soft marimba, plucked strings, warm pads, gentle shaker groove, steady and unobtrusive so a narrator can talk over it. A brighter, more energetic section in the middle for an action scene, then calm again and a warm resolving ending. Instrumental, no vocals, no chiptune.',
  },
}

async function post(path, body) {
  const r = await fetch(`https://api.elevenlabs.io${path}`, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return Buffer.from(await r.arrayBuffer())
}

const [mode, ...only] = process.argv.slice(2)
if (mode === 'sfx') {
  mkdirSync(`${root}${OUTDIR}`, { recursive: true })
  for (const [name, s] of Object.entries(SFX)) {
    if (only.length && !only.includes(name)) continue
    const mp3 = await post('/v1/sound-generation?output_format=mp3_44100_128', { text: s.text, duration_seconds: s.duration, prompt_influence: 0.5, model_id: 'eleven_text_to_sound_v2' })
    writeFileSync(`${root}${OUTDIR}/${name}.mp3`, mp3)
    console.log(`${OUTDIR}/${name}.mp3  ${(mp3.length / 1024).toFixed(0)} KB`)
  }
} else if (mode === 'music') {
  mkdirSync(`${root}music`, { recursive: true })
  for (const [name, m] of Object.entries(MUSIC)) {
    if (only.length && !only.includes(name)) continue
    const mp3 = await post('/v1/music?output_format=mp3_44100_128', { prompt: m.prompt, music_length_ms: m.ms, force_instrumental: true })
    writeFileSync(`${root}music/${name}.mp3`, mp3)
    console.log(`music/${name}.mp3  ${(mp3.length / 1024).toFixed(0)} KB`)
  }
} else {
  console.log('usage: node scripts/eleven.mjs sfx|music [names...]')
}
