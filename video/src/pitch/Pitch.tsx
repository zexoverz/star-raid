import { AbsoluteFill, Html5Audio, Sequence, Series, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { clamp } from '../ui'
import { FaceMode, FPS } from './parts'
import { PITCH_SCENES } from './scenes'

export const PITCH_TOTAL = PITCH_SCENES.reduce((a, s) => a + s.frames, 0)
const starts = PITCH_SCENES.map((_, i) => PITCH_SCENES.slice(0, i).reduce((a, s) => a + s.frames, 0))
const at = (id: string) => starts[PITCH_SCENES.findIndex((s) => s.id === id)]

/** Music bed: louder on the logo sting and the end card, tucked under the voice everywhere else. */
const BGM_LOOP = 88.04 // seconds; the track's intro is its loudest bit
function Bed() {
  const sting = at('sting')
  const meet = at('problem')
  const end = PITCH_TOTAL - Math.round(4.5 * FPS)
  const loop = Math.round(BGM_LOOP * FPS)
  // absolute-frame level; `loop` on Html5Audio passes a per-iteration frame, so play each pass explicitly
  const level = (f: number) =>
    interpolate(f, [0, sting - 6, sting + 4, meet - 8, meet + 6, end - 12, end, PITCH_TOTAL - 25, PITCH_TOTAL], [0.07, 0.07, 0.42, 0.42, 0.08, 0.08, 0.42, 0.42, 0], clamp)
  // on every pass after the first, the intro would jump out under the voice: hold it down, ease back in
  const intro = (t: number) => interpolate(t, [0, 14 * FPS, 18 * FPS], [0.4, 0.4, 1], clamp)
  const passes = Math.ceil(PITCH_TOTAL / loop)
  return (
    <>
      {Array.from({ length: passes }, (_, i) => (
        <Sequence key={i} from={i * loop} durationInFrames={Math.min(loop, PITCH_TOTAL - i * loop)} layout="none">
          <Html5Audio src={staticFile('audio/bgm.mp3')} volume={(t) => level(i * loop + t) * (i === 0 || i * loop + t >= end - 12 ? 1 : intro(t))} />
        </Sequence>
      ))}
    </>
  )
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
