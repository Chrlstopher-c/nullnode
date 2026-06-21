import { conversationPeers, type History } from '../session/history'
import { resolvePeerHandle } from '../comms/peer-label'
import type { Friend } from '../roster/types'

/** Filtre les conversations dont le handle du pair matche la recherche (insensible à la casse). */
export function filterHistory(history: History, friends: Friend[], query: string): History {
  const q = query.trim().toLowerCase()
  if (!q) return history
  const out: History = {}
  for (const peer of conversationPeers(history)) {
    if (resolvePeerHandle(peer, friends).toLowerCase().includes(q)) out[peer] = history[peer]
  }
  return out
}

/** Filtre le roster par pseudo/callsign/alias/adresse. */
export function filterFriends(friends: Friend[], query: string): Friend[] {
  const q = query.trim().toLowerCase()
  if (!q) return friends
  return friends.filter((f) =>
    `${f.pseudo} ${f.callsign} ${f.alias} ${f.address}`.toLowerCase().includes(q))
}
