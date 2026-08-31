import type { Friend } from '../../roster/types'
import type { SecureSession } from '../../session/use-secure-session'
import type { UnreadState } from '../../comms/use-unread'

interface Props {
  friends: Friend[]
  session: SecureSession
  unread: UnreadState
  onOpenChat: (address: string) => void
}

function fmtTime(at: number): string {
  const d = new Date(at)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toTimeString().slice(0, 5)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/** Fenêtre messages : liste des conversations, dernier message, non-lus, présence. */
export function MessagesWindow({ friends, session, unread, onOpenChat }: Props): React.ReactElement {
  const rows = friends
    .map((f) => {
      const msgs = session.messagesFor(f.address)
      const last = msgs[msgs.length - 1]
      return { friend: f, last, unread: unread.unreadFor(f.address) }
    })
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0))

  if (rows.length === 0) return <div className="ws-empty">aucune conversation — ajoute un pair dans Network.</div>

  return (
    <div>
      {rows.map(({ friend, last, unread: u }) => {
        const connected = session.connectedPeers.includes(friend.address)
        const cls = connected ? 'online' : friend.presence === 'away' ? 'away' : ''
        return (
          <div key={friend.address} className="ws-row" onClick={() => onOpenChat(friend.address)}>
            <span className={'presence ' + cls} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="handle">{friend.pseudo || friend.alias}</div>
              <div className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {last ? (last.author === 'self' ? 'moi : ' : '') + last.body : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              {last && <span className="meta">{fmtTime(last.at)}</span>}
              {u > 0 && <span className="unread">{u}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
