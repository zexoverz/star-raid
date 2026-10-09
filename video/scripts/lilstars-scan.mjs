// Reads lilstars.xyz (a JS-rendered site): page text for the script and screenshots for the video.
// Usage: node scripts/lilstars-scan.mjs  ->  public/lilstars/site/*.png and a text dump on stdout.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = new URL('../public/lilstars/site/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto('https://lilstars.xyz', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)
await p.screenshot({ path: `${OUT}home.png` })
const links = await p.$$eval('a', (as) => as.map((a) => `${a.textContent?.trim()} -> ${a.href}`))
console.log('LINKS\n' + [...new Set(links)].join('\n'))
for (const name of ['ABOUT US', 'CHARACTERS', 'COLLECTION', 'NEWS']) {
  const el = p.getByText(name, { exact: true }).first()
  if (!(await el.count())) continue
  await el.click().catch(() => {})
  await p.waitForTimeout(2000)
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  await p.screenshot({ path: `${OUT}${slug}.png` })
  console.log(`\n== ${name} (${p.url()})\n` + (await p.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, '\n').slice(0, 2500))
}
await b.close()
