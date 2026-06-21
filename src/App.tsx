import { AuthGate } from './auth/AuthGate'
import { NetworkScene } from './visualizer/NetworkScene'
import { SessionApp } from './SessionApp'
import { useIdentity } from './identity/use-identity'
import { useRelaySetting } from './settings/use-relay-setting'

export function App(): React.ReactElement {
  const identity = useIdentity()
  const relay = useRelaySetting()

  return (
    <main className="relative h-full w-full overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-60" />
      {identity.status !== 'ready' ? (
        <>
          <div className="absolute inset-0"><NetworkScene phase="idle" /></div>
          {(identity.status === 'anon' || identity.status === 'locked') && <AuthGate identity={identity} />}
        </>
      ) : (
        <SessionApp identity={identity} relay={relay} />
      )}
    </main>
  )
}
