// Star Raid web server: static app + share cards.
//
//   /r/:raid/:seat          the app (SPA) with Open Graph / Twitter meta for that seat's card
//   /og/:raid/:seat.png     1200x630 share card rendered server-side (satori -> resvg)
//   everything else         static files from dist/, SPA fallback to index.html
//
// `seat` is the Star token id of the seat (or "raid" for a raid-level card). Every number on the card
// comes from the live feed frame (AGENTS rule 13): counted, seats, wall share, no-seat buys. No price.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createReadStream, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(HERE, '..', 'dist')
const PORT = Number(process.env.PORT ?? 8080)
const LIVE = process.env.LIVE_URL ?? 'https://live-production-e50b.up.railway.app'
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'https://web-production-de387e.up.railway.app').replace(/\/$/, '')

const fonts = [
  { name: 'Gorditas', data: readFileSync(join(HERE, 'fonts/Gorditas-Bold.ttf')), weight: 700, style: 'normal' },
  { name: 'Outfit', data: readFileSync(join(HERE, 'fonts/Outfit-600.ttf')), weight: 600, style: 'normal' },
  { name: 'Outfit', data: readFileSync(join(HERE, 'fonts/Outfit-800.ttf')), weight: 800, style: 'normal' },
]

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' }

// ------------------------------------------------------------------ data

const cache = new Map()
async function frameOf(raidId) {
  const hit = cache.get(raidId)
  if (hit && Date.now() - hit.at < 15_000) return hit.frame
  const r = await fetch(`${LIVE}/raids/${encodeURIComponent(raidId)}`, { signal: AbortSignal.timeout(5000) })
  if (!r.ok) return null
  const pair = await r.json()
  const frame = pair.finalized ?? pair.proposed ?? null
  cache.set(raidId, { at: Date.now(), frame })
  return frame
}

const units = (v, d) => Number(BigInt(v ?? 0)) / 10 ** d
const fmt = (v, d) => {
  const n = units(v, d)
  return n >= 10_000 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function summarize(frame, seatParam) {
  const t = frame.terms
  const won = frame.won === true
  const settled = frame.status === 'Settled'
  const seat = frame.seats.find((s) => s.tokenId === seatParam) ?? null
  const rank = seat ? frame.seats.indexOf(seat) + 1 : null
  const share = BigInt(frame.totals.quoteSpent) > 0n ? Number((BigInt(frame.totals.wallFillQuote) * 100n) / BigInt(frame.totals.quoteSpent)) : 0
  const outcome = !settled ? (frame.status === 'Aborted' ? 'Called off' : 'Raid in progress') : won ? 'Wall broken!' : 'The wall held'
  return {
    t,
    won,
    settled,
    seat,
    rank,
    outcome,
    counted: fmt(frame.counted, t.quoteDecimals),
    target: fmt(t.target, t.quoteDecimals),
    bounty: fmt(t.bounty, t.quoteDecimals),
    seats: frame.seats.length,
    share,
    noSeat: frame.nonSeatBuys,
    seatCounted: seat ? fmt(seat.counted, t.quoteDecimals) : null,
    seatHits: seat?.buys ?? 0,
  }
}

// ------------------------------------------------------------------ star art (testnet preview mapping, as in src/lib/stars.ts)

const META = JSON.parse(readFileSync(join(HERE, '..', 'src', 'lib', 'stars-meta.json'), 'utf8'))
const PREVIEW = Object.keys(META)
const NAMES = { Chogstar: 'Chogstar', Bunny: 'Bunnystar', Fox: 'Foxstar', Bear: 'Bearstar' }
function starOf(tokenId) {
  if (!tokenId || !/^\d+$/.test(tokenId)) return null
  const artId = PREVIEW[Number(BigInt(tokenId) % BigInt(PREVIEW.length))]
  return { artId, name: `${NAMES[META[artId].character] ?? 'Star'} #${tokenId}`, legendary: META[artId].rarity === 'Legendary' }
}

async function dataUri(rel, mime = 'image/png') {
  // satori needs PNG/JPEG data; convert webp through resvg is not possible, so we keep PNG twins for the card.
  const buf = await readFile(join(HERE, 'img', rel))
  return `data:${mime};base64,${buf.toString('base64')}`
}

// ------------------------------------------------------------------ card

const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false) } })
const img = (src, style) => ({ type: 'img', props: { src, style } })

async function renderCard(frame, seatParam) {
  const s = summarize(frame, seatParam)
  const star = s.seat ? starOf(s.seat.tokenId) : null
  const bg = await dataUri('share_bg.png')
  const crew = await dataUri(s.won ? 'crew_cheer.png' : s.settled ? 'crew_sad.png' : 'crew_attack.png')
  const portrait = star ? await dataUri(`stars/${star.artId}.png`).catch(() => null) : null

  const stat = (label, value) =>
    h('div', { flexDirection: 'column', background: 'rgba(21,18,42,0.72)', borderRadius: 20, padding: '12px 18px', border: '3px solid #7a6eb2', minWidth: 150 },
      h('div', { fontFamily: 'Gorditas', fontSize: 40, color: '#ffffff' }, value),
      h('div', { fontFamily: 'Outfit', fontWeight: 800, fontSize: 16, color: '#b8aee6', letterSpacing: 2, textTransform: 'uppercase' }, label))

  const tree = h('div', { width: 1200, height: 630, position: 'relative', fontFamily: 'Outfit', color: 'white', background: '#221d3d' },
    img(bg, { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, objectFit: 'cover' }),
    h('div', { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, background: 'linear-gradient(90deg, rgba(21,18,42,0.2) 0%, rgba(21,18,42,0.85) 55%)' }),

    // left: the seat's Star (or the crew for a raid card)
    h('div', { position: 'absolute', left: 60, top: 70, width: 430, height: 490, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
      portrait
        ? h('div', { width: 360, height: 360, borderRadius: 40, border: `8px solid ${star?.legendary ? '#ffd27a' : '#ffb84d'}`, overflow: 'hidden', boxShadow: '0 10px 0 #2d2250' }, img(portrait, { width: 344, height: 344, objectFit: 'cover' }))
        : img(crew, { width: 420, height: 420, objectFit: 'contain' }),
      star ? h('div', { marginTop: 18, fontFamily: 'Gorditas', fontSize: 34, color: '#ffffff' }, star.name) : null,
      star ? h('div', { fontSize: 16, color: '#b8aee6' }, 'preview art on testnet') : null),

    // right: outcome and numbers
    h('div', { position: 'absolute', left: 520, top: 60, width: 630, flexDirection: 'column' },
      h('div', { fontFamily: 'Gorditas', fontSize: 30, color: '#f7b2d9' }, `Star Raid #${frame.raidId}`),
      h('div', { fontFamily: 'Gorditas', fontSize: 84, lineHeight: 1, color: s.won ? '#ffb84d' : '#ffffff', marginTop: 6 }, s.outcome),
      h('div', { fontSize: 26, color: '#fff4e4', marginTop: 16 },
        s.seat ? `This seat counted ${s.seatCounted} tUSDC in ${s.seatHits} ${s.seatHits === 1 ? 'hit' : 'hits'}, rank ${s.rank} of ${s.seats}.` : `${s.counted} of ${s.target} tUSDC counted by ${s.seats} verified ${s.seats === 1 ? 'seat' : 'seats'}.`),
      h('div', { marginTop: 26, gap: 14 },
        stat('counted', `${s.counted}/${s.target}`),
        stat('seats', String(s.seats)),
        stat('wall share', `${s.share}%`)),
      h('div', { marginTop: 14, gap: 14, alignItems: 'center' },
        stat('no-seat buys', String(s.noSeat)),
        h('div', { fontSize: 20, color: '#b8aee6', maxWidth: 330 }, s.won ? `Prize ${s.bounty} tUSDC split across the seats.` : s.settled ? 'The prize rolls to the next raid.' : 'One Lil Star, one seat.'))),

    // footer
    h('div', { position: 'absolute', left: 520, bottom: 36, alignItems: 'center', gap: 12 },
      h('div', { fontFamily: 'Gorditas', fontSize: 30, color: '#ffffff' }, 'Star'),
      h('div', { fontFamily: 'Gorditas', fontSize: 30, color: '#ffb84d' }, 'Raid'),
      h('div', { fontSize: 18, color: '#b8aee6', marginLeft: 10 }, 'Lil Stars raid the wall together · Monad testnet')))

  const svg = await satori(tree, { width: 1200, height: 630, fonts })
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

// ------------------------------------------------------------------ html meta

let indexHtml = null
async function index() {
  indexHtml ??= await readFile(join(DIST, 'index.html'), 'utf8')
  return indexHtml
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

async function sharePage(raidId, seat) {
  const html = await index()
  const frame = await frameOf(raidId).catch(() => null)
  let title = `Star Raid #${raidId}`
  let desc = 'Verified Lil Stars raid a sponsor\'s wall together on Kuru. One Star, one seat.'
  if (frame) {
    const s = summarize(frame, seat)
    title = `${s.outcome} · Star Raid #${raidId}`
    desc = s.seat ? `My Star counted ${s.seatCounted} tUSDC, rank ${s.rank} of ${s.seats} seats. ${s.counted}/${s.target} counted, ${s.share}% from the wall.` : `${s.counted}/${s.target} tUSDC counted by ${s.seats} seats, ${s.share}% from the wall.`
  }
  const image = `${PUBLIC_URL}/og/${encodeURIComponent(raidId)}/${encodeURIComponent(seat)}.png`
  const url = `${PUBLIC_URL}/r/${encodeURIComponent(raidId)}/${encodeURIComponent(seat)}`
  const meta = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join('\n    ')
  return html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`).replace('</head>', `    ${meta}\n  </head>`)
}

// ------------------------------------------------------------------ server

async function sendFile(res, path) {
  const s = await stat(path).catch(() => null)
  if (!s?.isFile()) return false
  const ext = extname(path)
  const immutable = path.includes(`${DIST}/assets/`) || path.includes('/art/') || path.includes('/stars/')
  res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' })
  createReadStream(path).pipe(res)
  return true
}

const STAR_CID = 'bafybeidmahvi2mlfn2gevjkhb4v2q4ourxon3yylqgakaesq6vpnooon6q'
const STAR_GATEWAYS = [`https://ipfs.filebase.io/ipfs/${STAR_CID}`, `https://gateway.pinata.cloud/ipfs/${STAR_CID}`, `https://ipfs.io/ipfs/${STAR_CID}`]
const STAR_SIZE = 256
const starCache = new Map() // id -> Promise<Buffer>
// Gateways throttle bursts: a page full of new seats fetches a few at a time instead of all at once.
let starActive = 0
const starQueue = []
async function starSlot(fn) {
  if (starActive >= 4) await new Promise((r) => starQueue.push(r))
  starActive++
  try {
    return await fn()
  } finally {
    starActive--
    starQueue.shift()?.()
  }
}
function starThumb(id) {
  if (!starCache.has(id)) {
    const job = starSlot(async () => {
      let lastErr
      for (const g of STAR_GATEWAYS) {
        try {
          const r = await fetch(`${g}/${id}.png`, { signal: AbortSignal.timeout(15_000) })
          // a busy gateway can 404 a file it has; try the next one and never cache a miss
          if (!r.ok) throw new Error(`${g} ${r.status}`)
          const src = Buffer.from(await r.arrayBuffer())
          // Wrap the PNG in an SVG image and let resvg resample it to a thumbnail.
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${STAR_SIZE}" height="${STAR_SIZE}"><image width="${STAR_SIZE}" height="${STAR_SIZE}" xlink:href="data:image/png;base64,${src.toString('base64')}"/></svg>`
          return new Resvg(svg, { fitTo: { mode: 'width', value: STAR_SIZE } }).render().asPng()
        } catch (e) {
          lastErr = e
        }
      }
      throw lastErr
    })
    starCache.set(id, job)
    // A failed fetch is retried on the next request instead of being cached forever.
    job.catch(() => starCache.delete(id))
  }
  return starCache.get(id)
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x')
    const p = decodeURIComponent(url.pathname)

    // Real Lil Stars art by token id, from the collection's IPFS folder, shrunk to a thumbnail once and
    // cached (the originals are 2048 px, ~2 MB each). The art itself is never altered, only resized.
    let s = p.match(/^\/star\/(\d{1,6})\.png$/)
    if (s) {
      const png = await starThumb(s[1]).catch((e) => (console.error('star', s[1], e.message), null))
      if (!png) return res.writeHead(404, { 'cache-control': 'no-store' }).end('no art')
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' })
      return res.end(png)
    }

    let m = p.match(/^\/og\/([^/]+)\/([^/]+)\.png$/)
    if (m) {
      const frame = await frameOf(m[1]).catch(() => null)
      if (!frame) return res.writeHead(404).end('no such raid')
      const png = await renderCard(frame, m[2])
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': frame.status === 'Settled' ? 'public, max-age=86400' : 'public, max-age=30' })
      return res.end(png)
    }

    m = p.match(/^\/r\/([^/]+)\/([^/]+)\/?$/)
    if (m) {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' })
      return res.end(await sharePage(m[1], m[2]))
    }

    const safe = normalize(p).replace(/^(\.\.[/\\])+/, '')
    if (safe !== '/' && (await sendFile(res, join(DIST, safe)))) return
    res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' })
    res.end(await index())
  } catch (e) {
    console.error(e)
    if (!res.headersSent) res.writeHead(500)
    res.end('error')
  }
}).listen(PORT, () => console.log(`star raid web on :${PORT}`))
