import { AbsoluteFill, Html5Audio, Sequence, Series, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { clamp } from '../ui'
import { FaceMode, FPS } from './parts'
import { PITCH_SCENES } from './scenes'

export const PITCH_TOTAL = PITCH_SCENES.reduce((a, s) => a + s.frames, 0)
const starts = PITCH_SCENES.map((_, i) => PITCH_SCENES.slice(0, i).reduce((a, s) => a + s.frames, 0))
const at = (id: string) => starts[PITCH_SCENES.findIndex((s) => s.id === id)]

/** Music bed: louder on the logo sting and the end card, tucked under the voice everywhere else. */
function Bed() {
  const sting = at('sting')
  const meet = at('problem')
  const end = PITCH_TOTAL - Math.round(4.5 * FPS)
  const volume = (f: number) =>
    interpolate(f, [0, sting - 6, sting + 4, meet - 8, meet + 6, end - 12, end, PITCH_TOTAL - 25, PITCH_TOTAL], [0.07, 0.07, 0.42, 0.42, 0.08, 0.08, 0.42, 0.42, 0], clamp)
  return <Html5Audio src={staticFile('audio/bgm.mp3')} volume={volume} loop />
}

function Whooshes() {
  return (
    <>
      {starts.slice(1).map((s, i) => (
        <Sequence key={i} from={Math.max(0, s - 6)} durationInFrames={24} layout="none">
          <Html5Audio src={staticFile('audio/kit/whoosh.mp3')} volume={0.3} />
        </Sequence>
      ))}
    </>
  )
}

/** Hard cuts with a tiny flash, like the reference: the face sections should feel live, not dissolved. */
function Flash() {
  const frame = useCurrentFrame()
  const near = starts.slice(1).map((s) => frame - s).find((d) => d >= 0 && d < 5)
  if (near === undefined) return null
  return <AbsoluteFill className="pointer-events-none z-[60] bg-white" style={{ opacity: interpolate(near, [0, 4], [0.35, 0], clamp) }} />
}

export function Pitch({ face = 'placeholder' }: { face?: 'placeholder' | 'off' }) {
  return (
    <FaceMode.Provider value={face}>
    <AbsoluteFill className="bg-grape-950">
      <Series>
        {PITCH_SCENES.map(({ id, C, frames }) => (
          <Series.Sequence key={id} name={id} durationInFrames={frames}>
            <C />
          </Series.Sequence>
        ))}
      </Series>
      <Bed />
      <Whooshes />
      <Flash />
    </AbsoluteFill>
    </FaceMode.Provider>
  )
}

/** The cut without his recordings: placeholder voice, no camera slots. */
export const PitchNoFace = () => <Pitch face="off" />
