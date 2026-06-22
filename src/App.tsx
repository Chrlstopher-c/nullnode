import { AuthGate } from './auth/AuthGate'
import { NetworkScene } from './visualizer/NetworkScene'
import { SceneBoundary } from './visualizer/SceneBoundary'
import { AmbientBackground } from './visualizer/AmbientBackground'
import { useRenderTier } from './visualizer/use-render-tier'
import { SessionApp } from './SessionApp'
import { useIdentity } from './identity/use-identity'
import { useRelaySetting } from './settings/use-relay-setting'
import { useVisualSetting } from './settings/use-visual-setting'

export function App(): React.ReactElement {
  const identity = useIdentity()
  const relay = useRelaySetting()
  const visual = useVisualSetting()
  // Scène 3D montée tant que le rendu n'est pas confirmé logiciel (WebKitGTK/llvmpipe ~2fps).
  // 'probing' la monte ~1,8s pour mesurer le FPS réel, puis la démonte si trop lent. Fond CSS sinon.
  const scene3d = useRenderTier() !== 'software'

  return (
    <main className="relative h-full w-full overflow-hidden">
      <AmbientBackground />
      {identity.status !== 'ready' ? (
        <>
          {scene3d && (
            <div className="absolute inset-0">
              <SceneBoundary><NetworkScene phase="idle" visual={visual.visual} /></SceneBoundary>
            </div>
          )}
          {(identity.status === 'anon' || identity.status === 'locked') && <AuthGate identity={identity} />}
        </>
      ) : (
        <SessionApp identity={identity} relay={relay} visual={visual} scene3d={scene3d} />
      )}
    </main>
  )
}
