import { useCallback, useEffect, useState } from 'react'
import sodium from 'libsodium-wrappers-sumo'
import { decodeAddress, callsign } from '../identity/address'
import { deriveFingerprint, ensureReady } from '../crypto/identity'
import { loadAccount, saveAccount } from '../shared/local-store'
import type { Friend, Presence } from './types'

/** Répare une entrée au schéma incomplet (pseudo/callsign/alias manquants) depuis sa clé. */
function healFriend(f: Friend): Friend {
  try {
    const cs = f.callsign || callsign(sodium.from_base64(f.pub))
    return { ...f, callsign: cs, pseudo: f.pseudo || cs, alias: f.alias || cs }
  } catch {
    const fallback = f.pseudo || f.callsign || f.alias || f.address.slice(0, 12)
    return { ...f, callsign: fallback, pseudo: fallback, alias: fallback }
  }
}

function buildFriend(address: string, pseudo: string): Friend {
  const pub = decodeAddress(address)
  const cs = callsign(pub)
  return {
    id: address.trim(),
    address: address.trim(),
    pub: sodium.to_base64(pub),
    alias: pseudo.trim() || cs,
    pseudo: pseudo.trim() || cs,
    callsign: cs,
    fingerprint: deriveFingerprint(pub),
    verified: false,
    presence: 'unknown',
    addedAt: Date.now(),
  }
}

export interface RosterState {
  friends: Friend[]
  addFriend: (address: string, pseudo: string) => { ok: boolean; error?: string }
  removeFriend: (id: string) => void
  hasFriend: (address: string) => boolean
  setPresence: (address: string, presence: Presence) => void
  updatePseudo: (address: string, pseudo: string) => void
  resetPresence: () => void
  hydrate: () => void
}

/** Local friends roster. No central directory — keys are stored and trusted locally. */
export function useRoster(selfId: string | null): RosterState {
  const addr = selfId ?? ''
  const [friends, setFriends] = useState<Friend[]>(() => loadAccount<Friend[]>(addr, 'roster', []))

  useEffect(() => { if (selfId) saveAccount(selfId, 'roster', friends) }, [friends, selfId])

  // Auto-réparation : comble les pseudos manquants (entrées issues d'un schéma partiel).
  useEffect(() => {
    ensureReady().then(() => {
      setFriends((prev) => {
        const needsHeal = prev.some((f) => !f.pseudo || !f.callsign)
        return needsHeal ? prev.map(healFriend) : prev
      })
    }).catch((err) => console.error('[roster] heal failed', err))
  }, [])

  const addFriend = useCallback((address: string, pseudo: string): { ok: boolean; error?: string } => {
    try {
      const friend = buildFriend(address, pseudo)
      if (friend.id === selfId) return { ok: false, error: 'THAT IS YOUR OWN ADDRESS' }
      if (friends.some((f) => f.id === friend.id)) return { ok: false, error: 'ALREADY IN ROSTER' }
      setFriends((prev) => [...prev, friend])
      return { ok: true }
    } catch {
      return { ok: false, error: 'INVALID NULLNODE ADDRESS' }
    }
  }, [friends, selfId])

  const removeFriend = useCallback((id: string): void => {
    setFriends((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const hasFriend = useCallback((address: string): boolean => {
    return friends.some((f) => f.address === address.trim())
  }, [friends])

  // Garde la MÊME référence de tableau si rien ne change (sinon boucle de re-render/announce).
  const setPresence = useCallback((address: string, presence: Presence): void => {
    setFriends((prev) => {
      const target = prev.find((f) => f.address === address)
      if (!target || target.presence === presence) return prev
      return prev.map((f) => (f.address === address ? { ...f, presence } : f))
    })
  }, [])

  // Met à jour le pseudo d'un ami (propagé quand il se renomme). Conserve un alias custom local.
  const updatePseudo = useCallback((address: string, pseudo: string): void => {
    const next = pseudo.trim()
    if (!next) return
    setFriends((prev) => {
      const target = prev.find((f) => f.address === address)
      if (!target || target.pseudo === next) return prev
      return prev.map((f) => (f.address === address ? { ...f, pseudo: next } : f))
    })
  }, [])

  const resetPresence = useCallback((): void => {
    setFriends((prev) => prev.map((f) => ({ ...f, presence: 'unknown' as Presence })))
  }, [])

  // Recharge le roster depuis le storage (après restauration d'un backup), sans reload de page.
  const hydrate = useCallback((): void => {
    setFriends(loadAccount<Friend[]>(addr, 'roster', []).map(healFriend))
  }, [addr])

  return { friends, addFriend, removeFriend, hasFriend, setPresence, updatePseudo, resetPresence, hydrate }
}
