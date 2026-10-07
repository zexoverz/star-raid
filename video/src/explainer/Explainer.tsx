import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { AbsoluteFill } from 'remotion'
import { sceneFrames, type LineId } from './parts'
import { Close, Draw, Lobby, Open, Problem, Raid, Results, Seats, Sponsor } from './scenes'

/** The 2-3 minute end-to-end explainer. Scene lengths follow the voiceover (src/explainer/vo.json). */
const ORDER: [LineId, () => React.JSX.Element][] = [
  ['open', Open],
  ['problem', Problem],
  ['lobby', Lobby],
  ['sponsor', Sponsor],
  ['seats', Seats],
  ['raid', Raid],
  ['draw', Draw],
  ['results', Results],
  ['close', Close],
]
const T = 12
export const EXPLAINER_TOTAL = ORDER.reduce((a, [id]) => a + sceneFrames(id), 0) - T * (ORDER.length - 1)

export function Explainer() {
  return (
    <AbsoluteFill className="bg-grape-950">
      <TransitionSeries>
        {ORDER.flatMap(([id, C], i) => {
          const seq = (
            <TransitionSeries.Sequence key={id} name={id} durationInFrames={sceneFrames(id)}>
              <C />
            </TransitionSeries.Sequence>
          )
          return i === ORDER.length - 1 ? [seq] : [seq, <TransitionSeries.Transition key={`${id}-t`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />]
        })}
      </TransitionSeries>
    </AbsoluteFill>
  )
}

export const EXPLAINER_SCENES = ORDER.map(([id, C]) => ({ id, frames: sceneFrames(id), C }))
