import type { PeerLink } from '../transport/peer-link'
import type { SessionKeys } from '../crypto/encryption'
import type { ConnectionPhase } from '../shared/types'

/** État runtime non réactif d'un pair : vit dans une ref Map, jamais re-rendu. */
export interface PeerRuntime {
  link: PeerLink
  keys: SessionKeys | null
  typingClear: ReturnType<typeof setTimeout> | null
  lastTypingSent: number
}

/** Vue réactive d'un pair : drive le re-render via le state du hook. */
export interface PeerView {
  phase: ConnectionPhase
  fingerprint: string
  typing: boolean
}

/** Crée une entrée runtime fraîche autour d'un PeerLink déjà construit. */
export function newRuntime(link: PeerLink, keys: SessionKeys | null): PeerRuntime {
  return { link, keys, typingClear: null, lastTypingSent: 0 }
}

/** Vue initiale au moment du handshake. */
export function newView(fingerprint: string): PeerView {
  return { phase: 'handshaking', fingerprint, typing: false }
}
