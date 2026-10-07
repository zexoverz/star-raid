import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion'
import { fmt, RAID, RAID_NO_SEAT } from '../data'
import { Cta } from '../scenes/Cta'
import { Hook } from '../scenes/Hook'
import { Bg, clamp, Guide, Pop, Sprite, StarAvatar, Title, Twinkles } from '../ui'
import { Callout, Chapter, LEAD, Scene, Screen, voFrames, type LineId } from './parts'

/** Frame inside a scene at a fraction of its voiceover line. */
const at = (id: LineId, frac: number) => LEAD + Math.round(voFrames(id) * frac)

export function Open() {
  return (
    <Scene id="open">
      <Hook />
    </Scene>
  )
}

export function Problem() {
  const frame = useCurrentFrame()
  const items = [
    { icon: 'bot', text: 'Bots farm the rewards', f: 0.12 },
    { icon: 'hourglass', text: 'Snipers wait for the last second', f: 0.25 },
    { icon: 'flag', text: "Sponsors can't tell who's real", f: 0.4 },
  ] as const
  const turn = at('problem', 0.66)
  return (
    <Scene id="problem">
      <Bg slot="lobbyBg" dim={0.7} />
      <Twinkles count={12} seed={4} />
      <AbsoluteFill className="items-center pt-20">
        <Title kicker="The problem" size={80}>
          Community buys are broken
        </Title>
        <div className="mt-14 flex gap-8">
          {items.map((it) => (
            <Pop key={it.text} delay={at('problem', it.f)} from="up" distance={120}>
              <div className="panel flex w-[480px] flex-col items-center gap-4 px-8 py-8 text-center" style={{ filter: frame > turn ? 'saturate(0.4) brightness(0.7)' : undefined }}>
                <Sprite slot={it.icon} className="h-28 w-28" />
                <div className="font-display text-[38px] leading-tight text-white">{it.text}</div>
              </div>
            </Pop>
          ))}
        </div>
        <Pop delay={turn} from="scale" className="mt-14">
          <div className="title-outline text-[76px] text-ember-400" style={{ transform: 'rotate(-2deg)' }}>
            → a co-op game the chain referees
          </div>
        </Pop>
      </AbsoluteFill>
    </Scene>
  )
}

export function Lobby() {
  return (
    <Scene id="lobby">
      <Screen src="rec/lobby.webm" path="/" zoom={[1, 1.04]} />
      <Chapter n={1} label="The lobby" />
      <Callout at={at('lobby', 0.3)} until={at('lobby', 0.62)} x={1180} y={420}>
        Next raid, live countdown
      </Callout>
      <Callout at={at('lobby', 0.65)} x={1160} y={250} tone="candy">
        Every raid, read from the chain
      </Callout>
    </Scene>
  )
}

export function Sponsor() {
  // Recorded on a local fork of Monad testnet with a test wallet: connect, type terms, confirm, 5 txs, raid posted.
  const seg: [number, number, number][] = [
    [1, 4, 1],
    [4, 19, 2.5],
    [19.5, 23, 1],
    [25, 36.5, 1.6],
  ]
  const f = (s: number) => LEAD + Math.round(s * 30)
  return (
    <Scene id="sponsor">
      <Screen src="rec/sponsor.webm" segments={seg} zoom={[1, 1.05]} origin="50% 40%" path="/sponsor" tag="testnet fork · test wallet" />
      <Chapter n={2} label="A sponsor posts a raid" />
      <Callout at={f(3)} until={f(8.6)} x={120} y={820}>
        Wall · cap price · prize · target · seat cap
      </Callout>
      <Callout at={f(9)} until={f(12.2)} x={1060} y={160} tone="candy">
        Plain-words terms before anything is signed
      </Callout>
      <Callout at={f(12.6)} until={f(16.5)} x={1080} y={860} tone="mint">
        Mint · approve · post: the wall is locked in the vault
      </Callout>
      <Callout at={f(16.6)} x={1080} y={860}>
        Missed target? The prize rolls to the next raid
      </Callout>
    </Scene>
  )
}

/** No wallet recording here (testnet keys): the app's own 3-step guide, rebuilt, plus real seats. */
export function Seats() {
  const seats = RAID_NO_SEAT.buys.filter((b) => b.seated)
  const steps = [
    { n: 1, icon: 'seatTicket', title: 'Get a Star and test tUSDC', body: 'A Lil Star is your seat. Free on testnet.' },
    { n: 2, icon: 'lock', title: 'Set up your raid key (once)', body: 'Sign one seat pass, fund a key in this browser.' },
    { n: 3, icon: 'spark', title: 'Join a raid and tap HIT', body: 'No popups. Every tap is a buy.' },
  ] as const
  return (
    <Scene id="seats">
      <Bg slot="lobbyBg" dim={0.65} />
      <Twinkles count={10} seed={8} />
      <Chapter n={3} label="Raiders take their seats" />
      <AbsoluteFill className="flex-row items-center justify-center gap-16 px-24 pb-16">
        <div className="flex flex-col items-center">
          <Title size={64}>
            One Star = <span className="text-ember-400">one seat</span>
          </Title>
          <div className="mt-10 flex gap-6">
            {seats.map((b, i) => (
              <Pop key={b.tokenId} delay={at('seats', 0.05) + i * 6}>
                <div className="panel flex w-[220px] flex-col items-center px-4 py-5">
                  <StarAvatar tokenId={b.tokenId} size={130} />
                  <div className="mt-3 font-display text-[28px] text-white">#{b.tokenId}</div>
                  <div className="chip mt-2 bg-mint text-[16px] text-grape-900">counts</div>
                </div>
              </Pop>
            ))}
            <Pop delay={at('seats', 0.24)}>
              <div className="panel flex w-[220px] flex-col items-center px-4 py-5" style={{ filter: 'saturate(0.5)' }}>
                <StarAvatar tokenId={null} size={130} />
                <div className="mt-3 font-display text-[28px] text-grape-300">No seat</div>
                <div className="chip mt-2 bg-grape-700 text-[16px] text-grape-100">+0</div>
              </div>
            </Pop>
          </div>
        </div>
        <div className="panel relative w-[720px] p-8 pt-10">
          <div className="font-display text-[40px] text-white">How to raid</div>
          <div className="text-[22px] text-grape-300">Three steps, once. Then every raid is tap-to-hit.</div>
          <div className="mt-6 space-y-4">
            {steps.map((s, i) => (
              <Pop key={s.n} delay={at('seats', 0.42 + i * 0.13)} from="right">
                <div className="flex items-center gap-5 rounded-3xl bg-grape-950/60 p-4 ring-2 ring-ember-400/60">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ember-500 font-display text-[28px] text-white">{s.n}</span>
                  <Sprite slot={s.icon} className="h-16 w-16" />
                  <div>
                    <div className="font-display text-[30px] text-white">{s.title}</div>
                    <div className="text-[22px] text-grape-300">{s.body}</div>
                  </div>
                </div>
              </Pop>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  )
}

export function Raid() {
  return (
    <Scene id="raid">
      <Screen src="rec/practice.webm" path="/practice" from={5} rate={1.9} zoom={[1, 1.1]} origin="35% 45%" tag="practice raid · sped up" />
      <Chapter n={4} label="The raid" />
      <Callout at={at('raid', 0.06)} until={at('raid', 0.3)} x={1120} y={560}>
        Each HIT = one Kuru buy at the cap
      </Callout>
      <Callout at={at('raid', 0.32)} until={at('raid', 0.55)} x={1120} y={560} tone="mint">
        Leftover cancelled + refunded, same tx
      </Callout>
      <Callout at={at('raid', 0.57)} until={at('raid', 0.8)} x={1120} y={560}>
        Counted by balance change, capped per seat
      </Callout>
      <Callout at={at('raid', 0.82)} x={1120} y={860} tone="candy">
        ☠ Danger zone: the end is drawn in here
      </Callout>
    </Scene>
  )
}

export function Draw() {
  return (
    <Scene id="draw">
      <Screen src="rec/results.webm" path={`/raid/${RAID.id}`} from={15} rate={1.3} zoom={[1, 1.08]} origin="50% 30%" tag={`real raid #${RAID.id} · draw replay`} />
      <Chapter n={5} label="The draw" />
      <Callout at={at('draw', 0.25)} until={at('draw', 0.55)} x={1180} y={240} tone="candy">
        End block from Pyth Entropy
      </Callout>
      <Callout at={at('draw', 0.58)} x={1180} y={240} tone="mint">
        Before it: counted · after it: no prize
      </Callout>
    </Scene>
  )
}

export function Results() {
  const split = Math.round(voFrames('results') * 0.68) + LEAD
  return (
    <Scene id="results">
      <Sequence durationInFrames={split}>
        <Screen src="rec/results.webm" path={`/raid/${RAID.id}`} from={0} zoom={[1, 1.05]} origin="50% 30%" tag={`real raid #${RAID.id} · Monad testnet`} />
        <Callout at={at('results', 0.08)} x={1160} y={420}>
          {RAID.countedHits} hits · {fmt(RAID.counted)} / {fmt(RAID.target)} counted
        </Callout>
      </Sequence>
      <Sequence from={split}>
        <Screen src="rec/share.webm" path={`/r/${RAID.id}/8`} from={1} zoom={[1, 1.06]} tag="share card" />
        <Callout at={10} x={1200} y={440} tone="candy">
          Claim after the hold, then share
        </Callout>
      </Sequence>
      <Chapter n={6} label="Victory, claim, share" />
    </Scene>
  )
}

export function Close() {
  const frame = useCurrentFrame()
  return (
    <Scene id="close">
      <Cta />
      <div className="absolute right-10 top-8 z-40" style={{ opacity: interpolate(frame, [20, 32], [0, 1], clamp) }}>
        <Guide who="fox" p="cheer" delay={20} size={150} side="left">
          See you at the wall!
        </Guide>
      </div>
    </Scene>
  )
}
