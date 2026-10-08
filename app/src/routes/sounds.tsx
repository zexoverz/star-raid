import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { NAMES, PICKS, sfxUrl, type Sfx } from '../lib/sfx'

/** Hidden sound picker (not in the nav): compare the current samples with the cute takes. */
export const Route = createFileRoute('/sounds')({ component: Sounds })

const HINT: Record<Sfx, string> = {
  hit: 'a buy landed',
  combo: 'buys in a row',
  join: 'a seat joined',
  tick: 'countdown tick',
  drum: 'drawing the end',
  reveal: 'end block revealed',
  victory: 'the wall broke',
  defeat: 'the wall held',
  click: 'button tap',
  coin: 'claim / prize',
}

const TAKES = [0, 1, 2, 3]

function Sounds() {
  const [picks, setPicks] = useState<Record<Sfx, number>>({ ...PICKS })
  const [playing, setPlaying] = useState('')
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(picks)

  const play = (n: Sfx, t: number) => {
    const key = `${n}-${t}`
    setPlaying(key)
    const a = new Audio(sfxUrl(n, t))
    a.onended = a.onerror = () => setPlaying((p) => (p === key ? '' : p))
    a.play().catch(() => setPlaying(''))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the JSON is shown below to copy by hand */
    }
  }

  return (
    <main className="relative pb-32 pt-24">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="title-outline -rotate-2 text-center text-5xl sm:text-6xl">Sound picker</h1>
        <p className="mt-3 text-center text-grape-300">Tap to listen. Pick one per sound, then copy your picks and send them back.</p>
        <div className="mt-8 space-y-4">
          {NAMES.map((n) => (
            <section key={n} className="panel p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl text-white">{n}</h2>
                <span className="text-sm text-grape-300">{HINT[n]}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TAKES.map((t) => {
                  const on = picks[n] === t
                  return (
                    <div key={t} className={`flex flex-col gap-2 rounded-2xl p-2 ${on ? 'bg-white/10 ring-2 ring-candy-500' : ''}`}>
                      <button type="button" onClick={() => play(n, t)} className={`btn ${t ? 'btn-primary' : 'btn-ghost'} min-h-14 w-full px-3 py-3 text-lg`}>
                        {playing === `${n}-${t}` ? '🔊' : '▶'} {t ? `Take ${t}` : 'Current'}
                      </button>
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 text-white">
                        <input type="radio" name={`pick-${n}`} checked={on} onChange={() => setPicks((p) => ({ ...p, [n]: t }))} className="h-6 w-6 accent-pink-500" />
                        pick
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="panel mt-8 p-4">
          <button type="button" onClick={copy} className="btn btn-candy min-h-14 w-full px-6 py-4 text-xl">
            {copied ? '✓ Copied' : '📋 Copy picks'}
          </button>
          <code className="mt-3 block select-all break-all rounded-xl bg-black/30 p-3 text-sm text-grape-300">{json}</code>
        </div>
      </div>
    </main>
  )
}
