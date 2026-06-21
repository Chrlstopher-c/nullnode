import { useCallback, useState } from 'react'
import { loadAccount, saveAccount } from '../shared/local-store'
import type { History } from '../session/history'

type Seen = Record<string, number>

export interface UnreadState {
  unreadFor: (peer: string) => number
  totalUnread: number
  markSeen: (peer: string) => void
}

/** Non-lus par pair = messages persistés − messages déjà vus. Robuste au refresh. Cloisonné par compte. */
export function useUnread(selfAddr: string, history: History): UnreadState {
  const [seen, setSeen] = useState<Seen>(() => loadAccount<Seen>(selfAddr, 'seen', {}))

  const unreadFor = useCallback((peer: string): number => {
    return Math.max(0, (history[peer]?.length ?? 0) - (seen[peer] ?? 0))
  }, [history, seen])

  const markSeen = useCallback((peer: string): void => {
    setSeen((prev) => {
      const target = history[peer]?.length ?? 0
      if ((prev[peer] ?? 0) === target) return prev // déjà à jour → même réf, pas de re-render
      const next = { ...prev, [peer]: target }
      saveAccount(selfAddr, 'seen', next)
      return next
    })
  }, [history, selfAddr])

  const totalUnread = Object.keys(history).reduce((sum, p) => sum + unreadFor(p), 0)
  return { unreadFor, totalUnread, markSeen }
}
