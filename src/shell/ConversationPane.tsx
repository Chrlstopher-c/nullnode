import { PanelLeft } from 'lucide-react'
import { MessageStream } from '../comms/MessageStream'
import { resolvePeerHandle } from '../comms/peer-label'
import type { SecureSession } from '../session/use-secure-session'
import type { Friend } from '../roster/types'

interface PaneProps {
  session: SecureSession
  chatPeer: string | null
  incomingPeer: string | null
  friends: Friend[]
  selfPseudo: string
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSend: (peer: string, body: string) => void
  onCloseChat: () => void
  onOpenChat: (peer: string) => void
  pinnedIds: string[]
  onTogglePin: (id: string) => void
  onVerify: (peer: string) => void
}

/** Zone principale : conversation ouverte (MessageStream) ou état vide. */
export function ConversationPane(props: PaneProps): React.ReactElement {
  const { session, chatPeer, sidebarOpen, onToggleSidebar } = props
  return (
    <div className="relative flex min-w-0 flex-1 flex-col p-4">
      {!sidebarOpen && (
        <button
          onClick={onToggleSidebar} title="afficher le panneau"
          className="absolute left-4 top-4 z-10 rounded border p-1.5 backdrop-blur-md"
          style={{ borderColor: 'var(--line)', background: 'rgba(12,15,17,0.7)', color: 'var(--text-mid)' }}
        >
          <PanelLeft size={15} />
        </button>
      )}
      {props.incomingPeer && !chatPeer && (
        <IncomingNotice peer={props.incomingPeer} friends={props.friends} onOpenChat={props.onOpenChat} />
      )}
      {chatPeer && (
        <div
          className="m-auto w-full max-w-[680px] rounded-lg border p-5 backdrop-blur-md"
          style={{ borderColor: 'var(--line)', background: 'rgba(12,15,17,0.72)' }}
        >
          <MessageStream
            session={session} peer={chatPeer} friends={props.friends}
            selfPseudo={props.selfPseudo} onSend={props.onSend} onBack={props.onCloseChat}
            pinnedIds={props.pinnedIds} onTogglePin={props.onTogglePin}
            verified={props.friends.find((f) => f.address === chatPeer)?.verified ?? false}
            onVerify={() => props.onVerify(chatPeer)}
          />
        </div>
      )}
    </div>
  )
}

/** Bandeau discret en haut quand un pair se connecte sans conversation ouverte. */
function IncomingNotice({ peer, friends, onOpenChat }: {
  peer: string; friends: Friend[]; onOpenChat: (p: string) => void
}): React.ReactElement {
  return (
    <button
      onClick={() => onOpenChat(peer)}
      className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded border px-3 py-2 backdrop-blur-md"
      style={{ borderColor: 'var(--accent-dim)', background: 'rgba(0,255,157,0.08)', color: 'var(--accent)' }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse-node 1.4s infinite' }} />
      <span className="text-[11px]">{resolvePeerHandle(peer, friends)} connecté — ouvrir</span>
    </button>
  )
}
