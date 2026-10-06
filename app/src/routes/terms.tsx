import { createFileRoute } from '@tanstack/react-router'
import { ADDR, EXPLORER } from '../lib/config'

export const Route = createFileRoute('/terms')({ component: Terms })

/** Plain and serious on purpose: no game styling here. */
function Terms() {
  const addrs: [string, string][] = [
    ['Raid vault', ADDR.vault],
    ['Raid router', ADDR.router],
    ['Seat gate', ADDR.seatGate],
    ['Kuru market (tSTAR/tUSDC)', ADDR.market],
    ['Test Lil Stars', ADDR.lilStars],
    ['Test USDC', ADDR.quote],
  ]
  return (
    <main className="pb-10 pt-28">
      <article className="mx-auto max-w-3xl rounded-3xl bg-cream-100 p-6 text-grape-900 sm:p-10">
        <h1 className="text-3xl font-extrabold">Terms of a raid</h1>
        <p className="mt-2 text-sm text-grape-700">Monad testnet. Test tokens only. Read this before you buy.</p>

        <Section title="What a raid is">
          A raid is a distribution event. A sponsor places a sell order (the wall) for its token on Kuru's on-chain order book at a cap price and funds a prize. For a short window of blocks, players buy that token with USDC. If seated buys from the wall, counted up to a randomly drawn end block, reach the sponsor's target, the prize is split among the seats in proportion to what each counted, capped per seat.
        </Section>
        <Section title="Seats">
          One Lil Stars token is one seat per raid; the seat is bound to the first wallet that uses it in that raid. Wallets without a seat can buy, and those buys go through, but they count for nothing toward the target or the prize.
        </Section>
        <Section title="How your order executes">
          Every buy is a limit order at the cap price. It fills only at or below the cap, and cheaper asks on the book from anyone fill first. Any unfilled remainder is cancelled in the same transaction and your unspent USDC is refunded. The cap price is shown before you confirm. Buying is not a bet on a price and this app shows no price, profit or return.
        </Section>
        <Section title="The end block">
          After the window closes, the end block is drawn by Pyth Entropy uniformly within the last quarter of the window. Buys after it still receive what they paid for, but do not count. Nothing that decides money uses block randomness or a future block hash.
        </Section>
        <Section title="Hold, claim and early exit">
          The tokens you buy are held by the router for your seat. After settlement, if the raid won, you can claim once the hold has passed to receive your tokens plus your prize share. You can exit early at any time after settlement to receive your tokens immediately and forfeit your prize share. If the raid lost, you can claim your tokens right after settlement.
        </Section>
        <Section title="Sponsor exclusion">
          The sponsor and any affiliates it lists cannot raid their own wall. The contract rejects them.
        </Section>
        <Section title="Kuru admin powers">
          Kuru's administrators can cancel orders on the book, including the sponsor's wall. If that happens, settlement still completes and refunds what is owed.
        </Section>
        <Section title="Not an offer">
          This is a testnet demonstration with test tokens that have no value. Nothing here is investment advice, an offer, or a solicitation. Do not treat any raid as a source of returns.
        </Section>
        <Section title="Credits">
          Lil Stars characters are pre-existing work of the Lil Stars team. The raid poses, outfits and scenes in this app are Star Raid event art generated from their character designs, with approval recorded in the project's decision log. Testnet seats show preview art from the Lil Stars collection.
        </Section>

        <h2 className="mt-8 text-lg font-extrabold">Contracts (Monad testnet, chain 10143)</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {addrs.map(([k, v]) => (
            <li key={k} className="flex flex-wrap justify-between gap-2 border-b border-grape-900/10 py-1">
              <span>{k}</span>
              <a className="font-mono text-xs underline" href={`${EXPLORER}/address/${v}`} target="_blank" rel="noreferrer">
                {v}
              </a>
            </li>
          ))}
        </ul>
      </article>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mt-1 leading-relaxed text-grape-800">{children}</p>
    </section>
  )
}
