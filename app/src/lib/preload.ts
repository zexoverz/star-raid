import { NAMES, sfxUrl } from './sfx'

/**
 * Everything a raid shows or plays, so the first screen and the first hit never pop in late.
 * The heavy official Lil Stars idle art (public/art/lilstars/{fox,chog,bunny,bear}.webp, ~2 MB) is
 * only an onError fallback for the crew poses, and the music streams on demand, so neither is here.
 */
const ART = [
  // scenes
  'hero_scene', 'raid_bg', 'lobby_bg', 'spotlight_stage', 'curtain', 'victory_burst',
  // the wall
  'wall_boss', 'wall_boss_hurt', 'wall_boss_ko',
  // props and icons
  'bot', 'chest_closed', 'chest_open', 'coin', 'defeat', 'dice_block', 'flag_sponsor', 'hit_spark',
  'hourglass', 'lock', 'medal_bronze', 'medal_gold', 'medal_silver', 'orb', 'seat_ticket', 'shield',
  'sparkle', 'trophy',
  // crew event poses (D35)
  ...['bear_attack', 'bear_cheer', 'bear_sad', 'bunny_attack', 'bunny_cheer', 'bunny_watch', 'chog_attack', 'chog_cheer', 'chog_wait', 'fox_attack', 'fox_cheer', 'fox_think'].map((p) => `crew/${p}`),
  // small official marks
  'lilstars/logo', 'lilstars/graffiti_logo', 'lilstars/Chogstar', 'lilstars/LilBunny', 'lilstars/LilFox', 'lilstars/LilMouse',
].map((n) => `/art/${n}.webp`)

const SVG = ['/art/wordmark.svg', '/art/wordmark-h.svg', '/art/brick_wall.svg', '/art/logo.svg']

/** Sound samples (the picked takes) go into the HTTP cache so turning sound on decodes them instantly. */
const SOUNDS = NAMES.map((n) => sfxUrl(n))

export const PRELOAD = { images: [...ART, ...SVG], sounds: SOUNDS }

function image(src: string) {
  return new Promise<void>((done) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      // decode() keeps the first paint of big backgrounds from janking the first animation frame
      img.decode?.().catch(() => undefined).finally(() => done())
    }
    img.onerror = () => done()
    img.src = src
  })
}

function file(src: string) {
  return fetch(src)
    .then((r) => r.arrayBuffer())
    .then(() => undefined)
    .catch(() => undefined)
}

function fonts() {
  // the three faces from index.html; resolves when the stylesheet's fonts are ready
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  const faces = ['400 1em Gorditas', '700 1em Gorditas', '700 1em Gluten', '400 1em Outfit', '700 1em Outfit', '800 1em Outfit']
  return Promise.all(faces.map((f) => document.fonts.load(f).catch(() => undefined))).then(() => undefined)
}

/**
 * Loads everything, reporting progress 0..1. Never rejects: a missing file counts as done, and a
 * slow network is cut off at `timeoutMs` so nobody is stuck on the loading screen.
 */
export function preloadAll(onProgress: (p: number) => void, timeoutMs = 12_000): Promise<void> {
  const jobs: (() => Promise<void>)[] = [fonts, ...PRELOAD.images.map((s) => () => image(s)), ...PRELOAD.sounds.map((s) => () => file(s))]
  let done = 0
  onProgress(0)
  const all = Promise.all(
    jobs.map((j) =>
      j().then(() => {
        done++
        onProgress(done / jobs.length)
      }),
    ),
  ).then(() => undefined)
  const cap = new Promise<void>((r) => setTimeout(r, timeoutMs))
  return Promise.race([all, cap])
}
