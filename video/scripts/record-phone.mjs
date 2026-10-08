// Phone-size recordings of the live app for the pitch video (390x844, iPhone 13, recorded at 2x so
// the phone mockup stays sharp). No wallet needed: lobby, raid board, practice raid with real taps,
// a settled raid with the draw replay, how it works, sponsor console. Run: node scripts/record-phone.mjs [clip ...]
import { chromium, devices } from 'playwright'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const SITE = process.env.SITE ?? 'https://web-production-de387e.up.railway.app'
const RAID = process.env.RAID ?? '26'
const OUT = new URL('../public/rec/phone/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function swipe(page, to, ms = 1400) {
  await page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = window.scrollY
        const t0 = performance.now()
        const step = (t) => {
          const k = Math.min(1, (t - t0) / ms)
          window.scrollTo(0, from + (to - from) * (1 - (1 - k) ** 3))
          k < 1 ? requestAnimationFrame(step) : done()
        }
        requestAnimationFrame(step)
      }),
    [to, ms],
  )
}
/** Navigate, let the app paint, then start keeping frames (no blank white tab at the start). */
async function go(page, url) {
  await page.goto(url, { waitUntil: 'load' })
  await wait(1500)
  page.__roll?.()
}
const tap = (page, loc) => loc.first().tap({ timeout: 8000 }).catch(() => loc.first().click({ timeout: 4000 }).catch(() => {}))

const CLIPS = {
  async lobby(p) {
    await go(p, SITE)
    await wait(2000)
    await swipe(p, 700)
    await wait(2500)
    await swipe(p, 1500)
    await wait(2500)
    await swipe(p, 0, 1000)
    await wait(1200)
  },
  async board(p) {
    await go(p, `${SITE}/raids`)
    await wait(1500)
    await tap(p, p.getByRole('button', { name: 'Walls broken' }))
    await wait(2500)
    await swipe(p, 500)
    await wait(2500)
  },
  // the core loop: the window opens, a burst of real taps on the HIT dock, combo, danger zone, draw, verdict
  async practice(p) {
    await go(p, `${SITE}/practice`)
    const hit = p.locator('button:visible:has-text("HIT!")').last()
    const t0 = Date.now()
    while (Date.now() - t0 < 30_000 && !(await hit.isEnabled().catch(() => false))) await wait(150)
    // 3 per hit keeps the 50 tUSDC practice budget (and so the HIT dock) alive through the combo
    await tap(p, p.locator('button:visible', { hasText: /^\s*3\s*$/ }))
    await wait(400)
    for (let i = 0; i < 14; i++) {
      await tap(p, p.locator('button:visible:has-text("HIT!")').last())
      await wait(i % 4 === 3 ? 900 : 380)
    }
    await wait(26_000)
  },
  async raid(p) {
    await go(p, `${SITE}/raid/${RAID}`)
    await wait(2500)
    await swipe(p, 800)
    await wait(2500)
    await swipe(p, 0, 900)
    await tap(p, p.getByRole('button', { name: /Replay the draw/ }))
    await wait(24_000)
  },
  async how(p) {
    await go(p, `${SITE}/how`)
    await wait(1000)
    for (const y of [600, 1300, 2000]) {
      await swipe(p, y)
      await wait(2200)
    }
  },
}

/**
 * Chrome's screencast gives frames at device pixels (780x1688 for an iPhone 13 at 2x); Playwright's
 * recordVideo only records CSS pixels. Frames are stamped with their capture time and stitched with
 * ffmpeg so playback speed matches real time.
 */
async function record(ctx, page, file, run) {
  const dir = `${OUT}.frames-${Date.now()}`
  mkdirSync(dir, { recursive: true })
  const cdp = await ctx.newCDPSession(page)
  const frames = []
  let rolling = false
  page.__roll = () => (rolling = true)
  cdp.on('Page.screencastFrame', async (f) => {
    if (!rolling) {
      await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
      return
    }
    const n = frames.length
    writeFileSync(`${dir}/${String(n).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64'))
    frames.push(f.metadata.timestamp)
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 })
  try {
    await run(page)
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {})
  }
  // concat list with each frame held until the next one arrived
  const lines = frames.map((t, i) => `file '${dir}/${String(i).padStart(6, '0')}.jpg'\nduration ${Math.max(0.001, (frames[i + 1] ?? t + 1 / 30) - t).toFixed(4)}`)
  lines.push(`file '${dir}/${String(frames.length - 1).padStart(6, '0')}.jpg'`)
  writeFileSync(`${dir}/list.txt`, lines.join('\n'))
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:0:color=0x15122a,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', file])
  rmSync(dir, { recursive: true, force: true })
  return frames.length
}

const pick = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS)
const browser = await chromium.launch()
for (const name of pick) {
  // The iPhone 13 profile's viewport is 390x664 (the page area under Safari's bars). The mockup has
  // no browser chrome, so render the app at the full 390x844 screen or the bottom would be empty.
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  // skip the loading screen (it has its own beat in the video)
  await ctx.addInitScript(() => sessionStorage.setItem('sr-loaded', '1'))
  const page = await ctx.newPage()
  const t = Date.now()
  let n = 0
  try {
    n = await record(ctx, page, `${OUT}${name}.mp4`, CLIPS[name])
  } catch (e) {
    console.error(`${name}: ${e.message.split('\n')[0]}`)
  }
  await ctx.close()
  console.log(`${name}.mp4 ${((Date.now() - t) / 1000).toFixed(0)} s, ${n} frames`)
}
await browser.close()
