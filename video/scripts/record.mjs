// Records the real app (prod, Monad testnet) as clips for the explainer. No wallet, no keys:
// lobby, how it works, sponsor console, the practice raid (full game loop), real settled raid
// pages with the draw replay, and the share card. Run: pnpm record [clip ...]
import { chromium } from 'playwright'
import { mkdirSync, renameSync, rmSync } from 'node:fs'

const SITE = process.env.SITE ?? 'https://web-production-de387e.up.railway.app'
const RAID = process.env.RAID ?? '26'
const SEAT = process.env.SEAT ?? '8'
const OUT = new URL('../public/rec/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
/** Smooth scroll so the recording reads like a person scrolling. */
async function glide(page, to, ms = 1800) {
  await page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = window.scrollY
        const t0 = performance.now()
        const step = (t) => {
          const k = Math.min(1, (t - t0) / ms)
          window.scrollTo(0, from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2))
          k < 1 ? requestAnimationFrame(step) : done()
        }
        requestAnimationFrame(step)
      }),
    [to, ms],
  )
}
async function glideTo(page, selector, offset = -120, ms = 1600) {
  const y = await page.locator(selector).first().evaluate((el, o) => el.getBoundingClientRect().top + window.scrollY + o, offset)
  await glide(page, y, ms)
}
/** Move the mouse visibly to an element (Playwright animates with steps). */
async function hover(page, locator) {
  const b = await locator.boundingBox()
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 })
}

const CLIPS = {
  // C1: lobby hero, featured raid, recent raids, how strip
  async lobby(page) {
    await page.goto(SITE, { waitUntil: 'load' })
    await wait(3500)
    await glide(page, 820, 2500)
    await wait(3000)
    await glide(page, 1600, 2500)
    await wait(2500)
    await glide(page, 0, 2000)
    await wait(1000)
  },
  // explainer page: the six beats
  async how(page) {
    await page.goto(`${SITE}/how`, { waitUntil: 'load' })
    await wait(2500)
    for (const y of [500, 1000, 1500, 2100]) {
      await glide(page, y, 1800)
      await wait(1800)
    }
  },
  // C2: sponsor console, no wallet (form, preview and how it works are visible)
  async sponsor(page) {
    await page.goto(`${SITE}/sponsor`, { waitUntil: 'load' })
    await wait(3500)
    await glide(page, 400, 2500)
    await wait(3500)
    await glide(page, 900, 2500)
    await wait(3500)
    await glide(page, 1400, 2500)
    await wait(3000)
    await glide(page, 0, 2500)
    await wait(1500)
  },
  // C5 + C6 stand-in: a full practice raid, tapping HIT through the window, then the draw and result
  async practice(page) {
    await page.goto(`${SITE}/practice`, { waitUntil: 'load' })
    await wait(1500)
    const hit = page.getByRole('button', { name: /HIT!/ }).first()
    await hover(page, hit)
    await hit.waitFor({ state: 'visible' })
    // wait for the window to open, then tap at a human pace
    const t0 = Date.now()
    while (Date.now() - t0 < 30_000 && !(await hit.isEnabled().catch(() => false))) await wait(200)
    for (let i = 0; i < 9; i++) {
      if (!(await hit.isEnabled().catch(() => false))) break
      await hit.click({ delay: 60 }).catch(() => {})
      await wait(900 + (i % 3) * 400)
    }
    // ride out the window, draw and verdict
    await wait(45_000)
  },
  // C7: a real settled raid: results, loot, podium, arena, then the draw replay
  async results(page) {
    await page.goto(`${SITE}/raid/${RAID}`, { waitUntil: 'load' })
    await wait(4000)
    await glide(page, 700, 2200)
    await wait(2500)
    await glide(page, 1500, 2200)
    await wait(2500)
    await glide(page, 0, 1500)
    const replay = page.getByRole('button', { name: /Replay the draw/ })
    if (await replay.count()) {
      await hover(page, replay)
      await replay.click()
      await wait(24_000)
    }
  },
  // C8: share card
  async share(page) {
    await page.goto(`${SITE}/r/${RAID}/${SEAT}`, { waitUntil: 'load' })
    await wait(5000)
    await glide(page, 500, 1800)
    await wait(2500)
  },
}

const pick = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS)
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
for (const name of pick) {
  const dir = `${OUT}.tmp-${name}`
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 1920, height: 1080 } } })
  const page = await ctx.newPage()
  const t = Date.now()
  try {
    await CLIPS[name](page)
  } catch (e) {
    console.error(`${name}: ${e.message}`)
  }
  const video = page.video()
  await ctx.close()
  const path = await video.path()
  renameSync(path, `${OUT}${name}.webm`)
  rmSync(dir, { recursive: true, force: true })
  console.log(`${name}.webm  ${((Date.now() - t) / 1000).toFixed(0)} s`)
}
await browser.close()
