import { linearTiming, springTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { AbsoluteFill, Html5Audio, staticFile } from 'remotion'
import { SLOTS } from './assets'
import { Cta } from './scenes/Cta'
import { Draw } from './scenes/Draw'
import { Hook } from './scenes/Hook'
import { Raid } from './scenes/Raid'
import { Seats } from './scenes/Seats'
import { Sponsor } from './scenes/Sponsor'
import { Victory } from './scenes/Victory'

export const FPS = 30
/** Scene lengths in frames. Edit here to retime the cut; the total is computed. */
export const SCENES = [
  { id: 'hook', frames: 120, C: Hook },
  { id: 'sponsor', frames: 150, C: Sponsor },
  { id: 'seats', frames: 140, C: Seats },
  { id: 'raid', frames: 290, C: Raid },
  { id: 'draw', frames: 200, C: Draw },
  { id: 'victory', frames: 160, C: Victory },
  { id: 'cta', frames: 150, C: Cta },
] as const
const T = 16 // transition length
export const TOTAL = SCENES.reduce((a, s) => a + s.frames, 0) - T * (SCENES.length - 1)

const timing = () => springTiming({ config: { damping: 200 }, durationInFrames: T })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentations: TransitionPresentation<any>[] = [wipe({ direction: 'from-left' }), slide({ direction: 'from-right' }), fade(), slide({ direction: 'from-bottom' }), fade(), wipe({ direction: 'from-top-left' })]

export function Main() {
  return (
    <AbsoluteFill className="bg-grape-950">
      {SLOTS.music && <Html5Audio src={staticFile(SLOTS.music)} volume={0.35} />}
      <TransitionSeries>
        {SCENES.flatMap(({ id, frames, C }, i) => {
          const seq = (
            <TransitionSeries.Sequence key={id} durationInFrames={frames} name={id}>
              <C />
            </TransitionSeries.Sequence>
          )
          if (i === SCENES.length - 1) return [seq]
          return [seq, <TransitionSeries.Transition key={`${id}-t`} presentation={presentations[i]} timing={i === 2 ? linearTiming({ durationInFrames: T }) : timing()} />]
        })}
      </TransitionSeries>
    </AbsoluteFill>
  )
}
