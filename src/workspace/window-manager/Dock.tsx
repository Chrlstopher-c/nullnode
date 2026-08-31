import { useState } from 'react'
import type { WindowManager } from './use-window-manager'

interface DockItem { key: string; icon: string; label: string; badge?: number }

interface Props {
  wm: WindowManager
  requestCount: number
  unreadCount: number
  presence: 'online' | 'away'
  onSetPresence: (p: 'online' | 'away') => void
}

/** Dock bas : ouvre/bascule les fenêtres système, badges live, contrôle de présence. */
export function Dock({ wm, requestCount, unreadCount, presence, onSetPresence }: Props): React.ReactElement {
  const [popOpen, setPopOpen] = useState(false)

  const items: DockItem[] = [
    { key: 'network', icon: '⌬', label: 'network', badge: requestCount || undefined },
    { key: 'messages', icon: '▤', label: 'messages', badge: unreadCount || undefined },
    { key: 'identity', icon: '◈', label: 'identity' },
    { key: 'system', icon: '⚙', label: 'system' },
  ]

  return (
    <>
      <div className="ws-dock">
        {items.map((it) => (
          <button
            key={it.key}
            className={'ws-dock-btn' + (wm.isOpen(it.key) ? ' has-open' : '')}
            onClick={() => wm.toggle(it.key)}
          >
            {it.icon}
            {it.badge ? <span className="badge">{it.badge}</span> : null}
            <span className="tip">{it.label}</span>
          </button>
        ))}
        <div className="ws-dock-sep" />
        <button
          className={'ws-dock-btn' + (popOpen ? ' has-open' : '')}
          onClick={(e) => { e.stopPropagation(); setPopOpen((v) => !v) }}
        >
          ◉<span className="tip">presence</span>
        </button>
      </div>

      <div className={'ws-presence-pop' + (popOpen ? ' show' : '')} style={{ right: 28 }}>
        <button
          className={presence === 'online' ? 'active' : ''}
          onClick={() => { onSetPresence('online'); setPopOpen(false) }}
        >● online</button>
        <button
          className={presence === 'away' ? 'active' : ''}
          onClick={() => { onSetPresence('away'); setPopOpen(false) }}
        >◐ away</button>
      </div>
    </>
  )
}
