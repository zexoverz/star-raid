import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from 'remotion'
import { sceneFrames, VoiceContext, type LineId } from './parts'
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

export function Explainer({ voice = true }: { voice?: boolean }) {
  return (
    <VoiceContext.Provider value={voice}>
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
      {/* soft whoosh on every cut, under the voice */}
      {ORDER.slice(1).map(([id], i) => {
        const at = ORDER.slice(0, i + 1).reduce((a, [x]) => a + sceneFrames(x), 0) - T * (i + 1) - 4
        return (
          <Sequence key={id} from={at} durationInFrames={18} layout="none">
            <Html5Audio src={staticFile('audio/kit/whoosh.mp3')} volume={0.4} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
    </VoiceContext.Provider>
  )
}

export const ExplainerSilent = () => <Explainer voice={false} />

export const EXPLAINER_SCENES = ORDER.map(([id, C]) => ({ id, frames: sceneFrames(id), C }))
