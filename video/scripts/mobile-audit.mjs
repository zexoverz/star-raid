// Phone audit: screenshots + layout metrics per page. Usage: node scripts/mobile-audit.mjs <site> <outdir> [width]
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const SITE = process.argv[2] ?? 'http://127.0.0.1:8092'
const OUT = process.argv[3] ?? '/tmp/audit'
const W = Number(process.argv[4] ?? 390)
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: W, height: 844 } })
const p = await ctx.newPage()
const pages = [
  ['lobby', '/', 3500],
  ['practice', '/practice', 11000],
  ['raid', '/raid/26', 4000],
  ['sponsor', '/sponsor', 3000],
  ['how', '/how', 2500],
  ['board', '/raids', 3000],
  ['key', '/key', 3000],
]
for (const [name, path, wait] of pages) {
  await p.goto(SITE + path, { waitUntil: 'load' })
  await p.waitForTimeout(wait)
  const m = await p.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect()
      const s = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    }
    const taps = [...document.querySelectorAll('button,a,[role=button]')].filter(vis)
    const small = taps.filter((e) => {
      const r = e.getBoundingClientRect()
      return r.height < 40 || r.width < 40
    })
    const tiny = [...document.querySelectorAll('body *')].filter((e) => e.childElementCount === 0 && e.textContent.trim() && vis(e) && parseFloat(getComputedStyle(e).fontSize) < 12)
    const hit = [...document.querySelectorAll('button')].find((e) => /HIT!/.test(e.textContent) && vis(e))
    return {
      over: document.documentElement.scrollWidth - innerWidth,
      screens: (document.documentElement.scrollHeight / innerHeight).toFixed(1),
      small: small.length,
      smallSample: small.slice(0, 4).map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)),
      tiny: tiny.length,
      hitTop: hit ? Math.round(hit.getBoundingClientRect().top) : null,
    }
  })
  console.log(`${name.padEnd(9)} overflow ${m.over}px · ${m.screens} screens · ${m.small} small taps ${JSON.stringify(m.smallSample)} · ${m.tiny} text<12px${m.hitTop !== null ? ` · HIT at y=${m.hitTop}` : ''}`)
  await p.screenshot({ path: `${OUT}/${name}.png` })
}
await b.close()
