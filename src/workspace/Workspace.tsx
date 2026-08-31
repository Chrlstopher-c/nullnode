import { useCallback, useMemo, useRef } from 'react'
import './workspace.css'
import { NetworkCanvas, type NetworkCanvasHandle } from './network-canvas/NetworkCanvas'
import type { TopologySnapshot } from './network-canvas/topology-engine'
import { useWindowManager } from './window-manager/use-window-manager'
import { Window } from './window-manager/Window'
import { Dock } from './window-manager/Dock'
import { NetworkWindow } from './windows/NetworkWindow'
import { MessagesWindow } from './windows/MessagesWindow'
import { IdentityWindow } from './windows/IdentityWindow'
import { SystemWindow } from './windows/SystemWindow'
import { ConversationWindow } from './windows/ConversationWindow'
import type { IdentityState } from '../identity/use-identity'
import type { RelaySetting } from '../settings/use-relay-setting'
import type { VisualSetting } from '../settings/use-visual-setting'
import type { RosterState } from '../roster/use-roster'
import type { SecureSession } from '../session/use-secure-session'
import type { UnreadState } from '../comms/use-unread'
import type { Friend, FriendRequest } from '../roster/types'

export interface WorkspaceProps {
  identity: IdentityState
  relay: RelaySetting
  visual: VisualSetting
  roster: RosterState
  session: SecureSession
  unread: UnreadState
  requests: FriendRequest[]
  relayOnline: boolean
  myPresence: 'online' | 'away'
  incomingPeer: string | null
  onSetPresence: (p: 'online' | 'away') => void
  onOpenChat: (peer: string) => void
  onSend: (peer: string, body: string) => void
  onVerify: (peer: string) => void
  pinnedIdsFor: (peer: string) => string[]
  onTogglePin: (peer: string, id: string) => void
  onSendRequest: (addr: string) => { ok: boolean; error?: string }
  onAccept: (r: FriendRequest) => void
  onDecline: (r: FriendRequest) => void
}

/** Shell post-login « canvas-OS » : topologie réseau vivante + dock + fenêtres flottantes. */
export function Workspace(props: WorkspaceProps): React.ReactElement {
  const { identity, roster, session, unread, requests, relayOnline, visual } = props
  const wm = useWindowManager()
  const canvasRef = useRef<NetworkCanvasHandle>(null)

  const snapshot: TopologySnapshot = useMemo(() => ({
    relayOnline,
    peers: roster.friends
      .map((f) => {
        const connected = session.connectedPeers.includes(f.address)
        if (connected) return { id: f.address, state: 'connected' as const, verified: f.verified }
        if (f.presence === 'online') return { id: f.address, state: 'online' as const, verified: f.verified }
        if (f.presence === 'away') return { id: f.address, state: 'away' as const, verified: f.verified }
        return null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  }), [roster.friends, session.connectedPeers, relayOnline])

  const friendFor = useCallback(
    (addr: string): Friend | undefined => roster.friends.find((f) => f.address === addr),
    [roster.friends],
  )

  const openConversation = useCallback((addr: string): void => {
    wm.open('conv:' + addr, { w: 440, h: 480 })
    props.onOpenChat(addr)
  }, [wm, props])

  const sendTo = useCallback((peer: string, body: string): void => {
    props.onSend(peer, body)
    canvasRef.current?.pulse(peer)
  }, [props])

  const reducedMotion = visual.visual.particleDensity === 0

  return (
    <div className="ws">
      <NetworkCanvas ref={canvasRef} snapshot={snapshot} reducedMotion={reducedMotion} />

      <div className="ws-hud">
        <div className="corner tl"><span className="wordmark"><span className="dot" />NULLNODE</span></div>
        <div className="status">
          STATUS: <span className={relayOnline ? 'val' : 'val val-bad'}>{relayOnline ? 'SECURE CHANNEL' : 'LINK LOST'}</span>
        </div>
        <div className="corner tr">{session.connectedPeers.length} LIVE · {roster.friends.length} PEERS</div>
        <div className="corner bl">LOCAL ID <span style={{ color: 'var(--text-hi)' }}>{identity.handle || '—'}</span></div>
        <div className="corner br">TRANSPORT <span style={{ color: 'var(--accent)' }}>WEBRTC / P2P</span></div>
      </div>

      {props.incomingPeer && (
        <div className="ws-incoming show" onClick={() => openConversation(props.incomingPeer!)}>
          <span className="pdot" />
          {(friendFor(props.incomingPeer)?.pseudo ?? props.incomingPeer)} connecté — ouvrir
        </div>
      )}

      {wm.windows.map((w) => {
        const focused = wm.focusedKey === w.key
        const common = {
          win: w, focused,
          onFocus: () => wm.focus(w.key),
          onClose: () => wm.close(w.key),
          onMove: (x: number, y: number) => wm.move(w.key, x, y),
          onDragChange: (d: boolean) => canvasRef.current?.setPaused(d),
        }
        if (w.key === 'network') {
          return (
            <Window key={w.key} {...common} icon="⌬" title="NETWORK" sub="peers · requests · discover">
              <NetworkWindow
                roster={roster} requests={requests}
                onChat={(f) => openConversation(f.address)}
                onAccept={props.onAccept} onDecline={props.onDecline} onSendRequest={props.onSendRequest}
              />
            </Window>
          )
        }
        if (w.key === 'messages') {
          return (
            <Window key={w.key} {...common} icon="▤" title="MESSAGES" sub="conversations">
              <MessagesWindow friends={roster.friends} session={session} unread={unread} onOpenChat={openConversation} />
            </Window>
          )
        }
        if (w.key === 'identity') {
          return (
            <Window key={w.key} {...common} icon="◈" title="IDENTITY" sub="profile · recovery · backup">
              <IdentityWindow identity={identity} />
            </Window>
          )
        }
        if (w.key === 'system') {
          return (
            <Window key={w.key} {...common} icon="⚙" title="SYSTEM" sub="relay · visual · about">
              <SystemWindow relay={props.relay} relayOnline={relayOnline} visual={visual} />
            </Window>
          )
        }
        if (w.key.startsWith('conv:')) {
          const addr = w.key.slice(5)
          const friend = friendFor(addr)
          const connected = session.connectedPeers.includes(addr)
          return (
            <Window
              key={w.key} {...common} icon="▣"
              title={friend?.pseudo ?? addr}
              sub={connected ? 'p2p secure' : 'offline'}
            >
              <ConversationWindow
                session={session} peer={addr} friends={roster.friends}
                selfPseudo={identity.pseudo} verified={!!friend?.verified}
                pinnedIds={props.pinnedIdsFor(addr)}
                onVerify={() => props.onVerify(addr)}
                onTogglePin={(id) => props.onTogglePin(addr, id)}
                onSend={sendTo}
                onClose={() => wm.close(w.key)}
              />
            </Window>
          )
        }
        return null
      })}

      <Dock
        wm={wm}
        requestCount={requests.length}
        unreadCount={unread.totalUnread}
        presence={props.myPresence}
        onSetPresence={props.onSetPresence}
      />
    </div>
  )
}
