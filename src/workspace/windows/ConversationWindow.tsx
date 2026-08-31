import { MessageStream } from '../../comms/MessageStream'
import type { SecureSession } from '../../session/use-secure-session'
import type { Friend } from '../../roster/types'

interface Props {
  session: SecureSession
  peer: string
  friends: Friend[]
  selfPseudo: string
  verified: boolean
  pinnedIds: string[]
  onVerify: () => void
  onTogglePin: (id: string) => void
  onSend: (peer: string, body: string) => void
  onClose: () => void
}

/** Fenêtre de conversation : flux chiffré réel (SAS, pins, composer) via MessageStream. */
export function ConversationWindow({
  session, peer, friends, selfPseudo, verified, pinnedIds, onVerify, onTogglePin, onSend, onClose,
}: Props): React.ReactElement {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <MessageStream
        session={session}
        peer={peer}
        friends={friends}
        selfPseudo={selfPseudo}
        verified={verified}
        onVerify={onVerify}
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin}
        onSend={onSend}
        onBack={onClose}
      />
    </div>
  )
}
