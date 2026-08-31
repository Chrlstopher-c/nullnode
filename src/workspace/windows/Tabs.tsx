import { useState } from 'react'

export interface TabDef { id: string; label: string; count?: number }

interface Props {
  tabs: TabDef[]
  children: (active: string) => React.ReactNode
}

/** Onglets internes d'une fenêtre. Le rendu du pane actif est délégué au parent. */
export function Tabs({ tabs, children }: Props): React.ReactElement {
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  return (
    <>
      <div className="ws-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={'ws-tab' + (t.id === active ? ' active' : '')}
            onClick={() => setActive(t.id)}
          >
            {t.label}
            {t.count ? <span className="count">{t.count}</span> : null}
          </button>
        ))}
      </div>
      <div className="ws-pane">{children(active)}</div>
    </>
  )
}
