import './style.css'
import './fonts'
import { Composition, Folder } from 'remotion'
import { FPS, Main, SCENES, TOTAL } from './Main'
import { EXPLAINER_SCENES, EXPLAINER_TOTAL, Explainer, ExplainerSilent } from './explainer/Explainer'

export function Root() {
  return (
    <>
      <Composition id="StarRaidDemo" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
      <Composition id="StarRaidExplainer" component={Explainer} durationInFrames={EXPLAINER_TOTAL} fps={FPS} width={1920} height={1080} />
      <Composition id="StarRaidExplainerNoVO" component={ExplainerSilent} durationInFrames={EXPLAINER_TOTAL} fps={FPS} width={1920} height={1080} />
      <Folder name="Explainer">
        {EXPLAINER_SCENES.map(({ id, frames, C }) => (
          <Composition key={id} id={`explainer-${id}`} component={C} durationInFrames={frames} fps={FPS} width={1920} height={1080} />
        ))}
      </Folder>
      <Folder name="Scenes">
        {SCENES.map(({ id, frames, C }) => (
          <Composition key={id} id={`scene-${id}`} component={C} durationInFrames={frames} fps={FPS} width={1920} height={1080} />
        ))}
      </Folder>
    </>
  )
}
