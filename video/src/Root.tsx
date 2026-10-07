import './style.css'
import './fonts'
import { Composition, Folder } from 'remotion'
import { FPS, Main, SCENES, TOTAL } from './Main'

export function Root() {
  return (
    <>
      <Composition id="StarRaidDemo" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
      <Folder name="Scenes">
        {SCENES.map(({ id, frames, C }) => (
          <Composition key={id} id={`scene-${id}`} component={C} durationInFrames={frames} fps={FPS} width={1920} height={1080} />
        ))}
      </Folder>
    </>
  )
}
