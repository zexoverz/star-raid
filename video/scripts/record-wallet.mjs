// Records wallet flows (sponsor console, raider setup) against a local anvil fork of Monad testnet,
// with the app served locally (VITE_RPC_URL pointing at the fork) and a test wallet injected
// (scripts/wallet.js) that uses anvil's unlocked dev accounts. No real keys, nothing sent on testnet.
//
//   anvil --fork-url https://testnet-rpc.monad.xyz --chain-id 10143 --port 8645
//   (cd ../app && VITE_RPC_URL=http://127.0.0.1:8645 npx vite --port 5179)
//   node scripts/record-wallet.mjs sponsor [--dry]
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'

const APP = process.env.APP ?? 'http://localhost:5179'
const FORK = process.env.FORK ?? 'http://127.0.0.1:8645'
const SPONSOR = process.env.SPONSOR ?? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // anvil dev account 1
const OUT = new URL('../public/rec/', import.meta.url).pathname
const WALLET = readFileSync(new URL('./wallet.js', import.meta.url), 'utf8')
const DRY = process.argv.includes('--dry')
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
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
async function point(page, locator) {
  await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {})
  const b = await locator.boundingBox({ timeout: 3000 }).catch(() => null)
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 })
  await wait(250)
}
/** Type like a person: clear the field, then key by key. Focus by script (AppKit leaves an overlay that eats clicks). */
async function typeInto(page, locator, text) {
  await point(page, locator)
  await locator.evaluate((el) => (el.focus(), el.select?.()))
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text, { delay: 110 })
  await wait(500)
}
async function press(page, locator) {
  await point(page, locator)
  await wait(300)
  await locator.evaluate((el) => el.click())
}
/** Anvil mines on demand; mine a block every 400 ms so the app sees a moving head like Monad. */
function ticker() {
  const t = setInterval(() => fetch(FORK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_mine', params: [] }) }).catch(() => {}), 400)
  return () => clearInterval(t)
}
async function connect(page) {
  const btn = page.getByRole('button', { name: /connect wallet/i }).first()
  if (!(await btn.isVisible({ timeout: 4000 }).catch(() => false))) return // already connected
  await press(page, btn)
  const pick = page.getByText('Test Wallet', { exact: true }).first()
  await pick.waitFor({ timeout: 15_000 })
  await wait(1200)
  await point(page, pick)
  await pick.click({ timeout: 5000 }).catch(() => pick.evaluate((el) => el.closest('button,[role=button],wui-list-wallet')?.click() ?? el.click()))
  await page.getByText(/0x7099/).first().waitFor({ timeout: 15_000 }).catch(() => {})
  await wait(1500)
}

const CLIPS = {
  async sponsor(page) {
    await page.goto(`${APP}/sponsor`, { waitUntil: 'load' })
    await wait(3000)
    await connect(page)
    await page.keyboard.press('Escape').catch(() => {})
    await page.getByText('Raid terms').waitFor({ timeout: 20_000 })
    await glide(page, 380, 1600)
    await wait(1200)
    const inputs = page.locator('main input[inputmode="decimal"]')
    await typeInto(page, inputs.nth(0), '100000') // wall
    await typeInto(page, inputs.nth(1), '0.026') // cap
    await typeInto(page, inputs.nth(2), '50') // prize
    await typeInto(page, inputs.nth(3), '500') // target
    await typeInto(page, inputs.nth(4), '600') // seat cap
    await wait(1200)
    const postBtn = page.getByRole('button', { name: /Post this raid/ })
    await point(page, postBtn)
    await wait(1500)
    if (!(await postBtn.isEnabled())) {
      console.log('post disabled:', await page.locator('main ul.text-candy-300, main p.text-ember-300').allInnerTexts().catch(() => []))
      return
    }
    await press(page, postBtn)
    await wait(3000) // the plain-words confirm sheet
    const ok = page.getByRole('button', { name: /I understand, post/ })
    await press(page, ok)
    // tx steps tick: mint, approve, post
    await page.getByText(/Watch raid #\d+/).first().waitFor({ timeout: 60_000 }).catch((e) => console.log('no posted link', e.message))
    await point(page, page.getByText(/Watch raid #\d+/).first())
    await wait(5000)
  },
}

const pick = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const browser = await chromium.launch()
for (const name of pick.length ? pick : Object.keys(CLIPS)) {
  const dir = `${OUT}.tmp-${name}`
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ...(DRY ? {} : { recordVideo: { dir, size: { width: 1920, height: 1080 } } }),
  })
  await ctx.addInitScript({ content: `window.__REC_RPC__=${JSON.stringify(FORK)};window.__REC_ACCOUNT__=${JSON.stringify(SPONSOR)};try{localStorage.setItem('starraid.guide.${SPONSOR.toLowerCase()}','1')}catch{};\n${WALLET}` })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 160)))
  const stop = ticker()
  const t = Date.now()
  try {
    await CLIPS[name](page)
  } catch (e) {
    console.error(`${name}: ${e.message.split('\n')[0]}`)
    await page.screenshot({ path: `${OUT}${name}-fail.png` })
  }
  stop()
  if (DRY) await page.screenshot({ path: `${OUT}${name}-dry.png` })
  const video = page.video()
  await ctx.close()
  if (video) {
    renameSync(await video.path(), `${OUT}${name}.webm`)
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(`${name} ${((Date.now() - t) / 1000).toFixed(0)} s, txs sent: see anvil`)
}
await browser.close()
