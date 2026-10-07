// Re-snapshot the raids the video replays from the live service (finalized frames). Run: pnpm snapshot
import { writeFileSync } from 'node:fs'

const LIVE = process.env.LIVE_URL ?? 'https://live-production-e50b.up.railway.app'
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ['26', '3']) {
  const r = await fetch(`${LIVE}/raids/${id}`)
  if (!r.ok) throw new Error(`raid ${id}: ${r.status}`)
  const body = await r.json()
  if (!body.finalized) throw new Error(`raid ${id} has no finalized frame`)
  writeFileSync(new URL(`../src/data/raid-${id}.json`, import.meta.url), JSON.stringify(body))
  console.log(`raid ${id}: ${body.finalized.status}, ${body.finalized.buys.length} buys`)
}
