import { useCallback, useState } from 'react'
import { loadAccount, saveAccount } from '../shared/local-store'

type Pins = Record<string, string[]>

export interface PinsState {
  pinnedIds: (peer: string) => string[]
  isPinned: (peer: string, id: string) => boolean
  togglePin: (peer: string, id: string) => boolean
  applyRemote: (peer: string, id: string, pinned: boolean) => void
}

/** Ids épinglés par pair, partagés entre les deux côtés. Persisté, cloisonné par compte. */
export function usePins(selfAddr: string): PinsState {
  const [pins, setPins] = useState<Pins>(() => loadAccount<Pins>(selfAddr, 'pins', {}))

  const pinnedIds = useCallback((peer: string): string[] => pins[peer] ?? [], [pins])
  const isPinned = useCallback((peer: string, id: string): boolean => (pins[peer] ?? []).includes(id), [pins])

  // Bascule sur l'état courant lu dans le setter (jamais sur une closure stale).
  const togglePin = useCallback((peer: string, id: string): boolean => {
    let result = false
    setPins((prev) => {
      const list = prev[peer] ?? []
      const pinned = !list.includes(id)
      result = pinned
      const nextList = pinned ? [...list, id] : list.filter((x) => x !== id)
      const next = { ...prev, [peer]: nextList }
      saveAccount(selfAddr, 'pins', next)
      return next
    })
    return result
  }, [selfAddr])

  // Applique l'état cible reçu du pair (idempotent, même réf si rien ne change).
  const applyRemote = useCallback((peer: string, id: string, pinned: boolean): void => {
    setPins((prev) => {
      const list = prev[peer] ?? []
      if (list.includes(id) === pinned) return prev
      const nextList = pinned ? [...list, id] : list.filter((x) => x !== id)
      const next = { ...prev, [peer]: nextList }
      saveAccount(selfAddr, 'pins', next)
      return next
    })
  }, [selfAddr])

  return { pinnedIds, isPinned, togglePin, applyRemote }
}
