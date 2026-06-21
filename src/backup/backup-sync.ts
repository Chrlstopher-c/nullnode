// Collecte et fusion de l'état sauvegardable (roster + historique + seen + pseudo).
// Fonctions pures sur le localStorage local-first. Le merge est convergent (union),
// jamais destructif : il complète l'état local avec le blob distant.

import { loadAccount, saveAccount } from '../shared/local-store'
import type { BackupState } from './backup-crypto'
import type { Friend } from '../roster/types'
import type { History } from '../session/history'
import type { SecureMessage } from '../shared/types'

type Seen = Record<string, number>

/** Lit l'état courant depuis la partition du compte pour le sceller. */
export function collectBackupState(selfAddr: string): BackupState {
  return {
    roster: loadAccount<Friend[]>(selfAddr, 'roster', []),
    history: loadAccount<History>(selfAddr, 'history', {}),
    seen: loadAccount<Seen>(selfAddr, 'seen', {}),
    pseudo: loadAccount<string>(selfAddr, 'pseudo', ''),
  }
}

/** Fusionne un blob distant dans la partition du compte. Retourne true si quelque chose a changé. */
export function mergeBackupState(selfAddr: string, remote: BackupState): boolean {
  const roster = mergeRoster(selfAddr, asFriends(remote.roster))
  const history = mergeHistory(selfAddr, asHistory(remote.history))
  const seen = mergeSeen(selfAddr, asSeen(remote.seen))
  const pseudo = mergePseudo(selfAddr, typeof remote.pseudo === 'string' ? remote.pseudo : '')
  return roster || history || seen || pseudo
}

function mergeRoster(selfAddr: string, remote: Friend[]): boolean {
  const local = loadAccount<Friend[]>(selfAddr, 'roster', [])
  const known = new Set(local.map((f) => f.address))
  const added = remote.filter((f) => f && f.address && !known.has(f.address))
  if (!added.length) return false
  saveAccount(selfAddr, 'roster', [...local, ...added])
  return true
}

function mergeHistory(selfAddr: string, remote: History): boolean {
  const local = loadAccount<History>(selfAddr, 'history', {})
  let changed = false
  for (const [peer, msgs] of Object.entries(remote)) {
    const merged = unionMessages(local[peer] ?? [], msgs ?? [])
    if (merged.length !== (local[peer]?.length ?? 0)) { local[peer] = merged; changed = true }
  }
  if (changed) saveAccount(selfAddr, 'history', local)
  return changed
}

function unionMessages(a: SecureMessage[], b: SecureMessage[]): SecureMessage[] {
  const byId = new Map<string, SecureMessage>()
  for (const m of [...a, ...b]) if (m && m.id) byId.set(m.id, m)
  return [...byId.values()].sort((x, y) => x.at - y.at)
}

function mergeSeen(selfAddr: string, remote: Seen): boolean {
  const local = loadAccount<Seen>(selfAddr, 'seen', {})
  let changed = false
  for (const [peer, count] of Object.entries(remote)) {
    if ((local[peer] ?? 0) < count) { local[peer] = count; changed = true }
  }
  if (changed) saveAccount(selfAddr, 'seen', local)
  return changed
}

function mergePseudo(selfAddr: string, remote: string): boolean {
  if (!remote) return false
  if (loadAccount<string>(selfAddr, 'pseudo', '')) return false
  saveAccount(selfAddr, 'pseudo', remote)
  return true
}

// Coercions défensives : le blob vient du réseau, on ne fait jamais confiance à sa forme.
function asFriends(v: unknown): Friend[] {
  return Array.isArray(v) ? (v as Friend[]) : [] // narrowing par Array.isArray, champs lus défensivement
}
function asHistory(v: unknown): History {
  return typeof v === 'object' && v !== null ? (v as History) : {} // objet non-null garanti
}
function asSeen(v: unknown): Seen {
  return typeof v === 'object' && v !== null ? (v as Seen) : {} // objet non-null garanti
}
