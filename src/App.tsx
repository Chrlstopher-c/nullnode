import { AuthGate } from './auth/AuthGate'
import { NetworkScene } from './visualizer/NetworkScene'
import { SceneBoundary } from './visualizer/SceneBoundary'
import { AmbientBackground } from './visualizer/AmbientBackground'
import { SessionApp } from './SessionApp'
import { useIdentity } from './identity/use-identity'
import { useRelaySetting } from './settings/use-relay-setting'
import { useVisualSetting } from './settings/use-visual-setting'

export function App(): React.ReactElement {
  const identity = useIdentity()
  const relay = useRelaySetting()
  const visual = useVisualSetting()

  return (
    <main className="relative h-full w-full overflow-hidden">
      <AmbientBackground />
      {identity.status !== 'ready' ? (
        <>
          <div className="absolute inset-0">
            <SceneBoundary><NetworkScene phase="idle" visual={visual.visual} /></SceneBoundary>
          </div>
          {(identity.status === 'anon' || identity.status === 'locked') && <AuthGate identity={identity} />}
        </>
      ) : (
        <SessionApp identity={identity} relay={relay} visual={visual} />
      )}
    </main>
  )
}
