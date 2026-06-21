import { callsign, discriminator } from '../identity/address'
import sodium from 'libsodium-wrappers-sumo'
import type { Friend, Presence } from './types'
import type { RosterState } from './use-roster'

const PRESENCE_COLOR: Record<Presence, string> = {
  online: 'var(--accent)',
  away: 'var(--warn)',
  offline: 'var(--text-lo)',
  unknown: 'var(--text-lo)',
}

interface Props {
  roster: RosterState
  onChat: (friend: Friend) => void
}

function friendHandle(f: Friend): string {
  try {
    const pub = sodium.from_base64(f.pub)
    return `${f.pseudo || callsign(pub)}#${discriminator(pub)}`
  } catch { return f.pseudo || f.callsign || f.alias || f.address.slice(0, 14) }
}

/** Roster list — each friend with presence and a chat action. */
export function FriendsList({ roster, onChat }: Props): React.ReactElement {
  if (roster.friends.length === 0) {
    return <span className="text-[10px]" style={{ color: 'var(--text-lo)' }}>no peers yet — send a request above.</span>
  }
  return (
    <div className="flex flex-col gap-1 overflow-auto pr-1" style={{ maxHeight: '30vh' }}>
      {roster.friends.map((f) => {
        const online = f.presence === 'online'
        return (
          <div
            key={f.id}
            className="group flex items-center gap-3 rounded border border-transparent px-2 py-2 transition-colors hover:border-[var(--line)]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRESENCE_COLOR[f.presence] }} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px]" style={{ color: 'var(--text-hi)' }}>{friendHandle(f)}</span>
              <span className="text-[9px]" style={{ color: 'var(--text-lo)' }}>{f.presence}</span>
            </div>
            <button
              onClick={() => onChat(f)}
              disabled={!online}
              title={online ? 'open secure chat' : 'peer offline'}
              className="text-[14px] transition-opacity disabled:opacity-25"
              style={{ color: 'var(--accent)' }}
            >💬</button>
            <button
              onClick={() => roster.removeFriend(f.id)}
              className="text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--danger)' }}
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}
