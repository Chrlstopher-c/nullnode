import { conversationPeers, type History } from '../session/history'
import { resolvePeerHandle, peerPresence } from './peer-label'
import type { Friend } from '../roster/types'

interface Props {
  history: History
  friends: Friend[]
  unreadFor: (peer: string) => number
  onOpen: (peer: string) => void
}

const PRESENCE_COLOR: Record<string, string> = {
  online: 'var(--accent)', away: 'var(--warn)', offline: 'var(--text-lo)', unknown: 'var(--text-lo)',
}

/** Recent conversations, most-recent first, with unread badges. */
export function ConversationList({ history, friends, unreadFor, onOpen }: Props): React.ReactElement {
  const peers = conversationPeers(history)
  if (peers.length === 0) {
    return <span className="text-[11px]" style={{ color: 'var(--text-lo)' }}>aucune conversation — démarre depuis un contact.</span>
  }
  return (
    <div className="flex flex-col gap-1 overflow-auto pr-1" style={{ maxHeight: '60vh' }}>
      {peers.map((p) => {
        const msgs = history[p]
        const last = msgs[msgs.length - 1]
        const unread = unreadFor(p)
        return (
          <button
            key={p} onClick={() => onOpen(p)}
            className="flex items-center gap-3 rounded border border-transparent px-3 py-2 text-left transition-colors hover:border-[var(--line)]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRESENCE_COLOR[peerPresence(p, friends)] }} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px]" style={{ color: 'var(--text-hi)' }}>{resolvePeerHandle(p, friends)}</span>
              <span className="truncate text-[10px]" style={{ color: 'var(--text-lo)' }}>
                {last.author === 'self' ? 'you: ' : ''}{last.body}
              </span>
            </div>
            {unread > 0 && (
              <span className="shrink-0 rounded-full px-2 text-[9px]" style={{ background: 'var(--accent)', color: 'var(--void)' }}>{unread}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
