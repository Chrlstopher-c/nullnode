import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { ConversationPane } from './ConversationPane'
import { ProfileDrawer } from './ProfileDrawer'
import { useLayout } from './use-layout'
import type { IdentityState } from '../identity/use-identity'
import type { RelaySetting } from '../settings/use-relay-setting'
import type { VisualSetting } from '../settings/use-visual-setting'
import type { RosterState } from '../roster/use-roster'
import type { SecureSession } from '../session/use-secure-session'
import type { UnreadState } from '../comms/use-unread'
import type { FriendRequest } from '../roster/types'

interface AppShellProps {
  identity: IdentityState
  relay: RelaySetting
  visual: VisualSetting
  roster: RosterState
  session: SecureSession
  unread: UnreadState
  requests: FriendRequest[]
  relayOnline: boolean
  peerCount: number
  myPresence: 'online' | 'away'
  onSetPresence: (state: 'online' | 'away') => void
  chatPeer: string | null
  incomingPeer: string | null
  onOpenChat: (peer: string) => void
  onCloseChat: () => void
  pinnedIds: string[]
  onTogglePin: (id: string) => void
  onSend: (peer: string, body: string) => void
  onVerify: (peer: string) => void
  onSendRequest: (addr: string) => { ok: boolean; error?: string }
  onAccept: (r: FriendRequest) => void
  onDecline: (r: FriendRequest) => void
}

/** Frame applicatif 2D au-dessus du background cosmétique : sidebar repliable + conversation + drawer profil. */
export function AppShell(props: AppShellProps): React.ReactElement {
  const layout = useLayout()
  const { identity, relay, roster, session, unread, requests, relayOnline, peerCount } = props
  return (
    <div className="absolute inset-0 z-10 flex">
      <AnimatePresence initial={false}>
        {layout.sidebarOpen && (
          <motion.div
            initial={{ x: -360 }} animate={{ x: 0 }} exit={{ x: -360 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }} className="h-full"
          >
            <Sidebar
              layout={layout} roster={roster} history={session.history} friends={roster.friends}
              unreadFor={unread.unreadFor} requests={requests}
              onOpenChat={props.onOpenChat} onAccept={props.onAccept} onDecline={props.onDecline}
              onSendRequest={props.onSendRequest} relayOnline={relayOnline}
              relayUrl={relay.relayUrl} peerCount={peerCount}
              selfHandle={identity.handle} onOpenProfile={() => layout.setProfileOpen(true)}
              myPresence={props.myPresence} onSetPresence={props.onSetPresence}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ConversationPane
        session={session} chatPeer={props.chatPeer} incomingPeer={props.incomingPeer}
        friends={roster.friends} selfPseudo={identity.pseudo} sidebarOpen={layout.sidebarOpen}
        onToggleSidebar={layout.toggleSidebar} onSend={props.onSend}
        onCloseChat={props.onCloseChat} onOpenChat={props.onOpenChat}
        pinnedIds={props.pinnedIds} onTogglePin={props.onTogglePin} onVerify={props.onVerify}
      />

      <ProfileDrawer
        identity={identity} relay={relay} visual={props.visual} relayOnline={relayOnline}
        open={layout.profileOpen} onClose={() => layout.setProfileOpen(false)}
      />
    </div>
  )
}
