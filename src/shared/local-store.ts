/** Typed localStorage wrapper. Local-first persistence — nothing leaves the device. */
const PREFIX = 'nullnode.'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch (err) {
    console.error('[store] load failed', key, err)
    return fallback
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (err) {
    console.error('[store] save failed', key, err)
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch (err) {
    console.error('[store] remove failed', key, err)
  }
}

// ── Stockage cloisonné par compte ───────────────────────────────────────────
// Chaque identité a sa propre partition (roster, historique, etc.) pour qu'aucune
// donnée ne fuite d'un compte à l'autre sur la même machine.

export const ACCOUNT_KEYS = ['roster', 'history', 'seen', 'requests', 'pseudo'] as const
export type AccountKey = (typeof ACCOUNT_KEYS)[number]

function accountKey(addr: string, key: AccountKey): string {
  return `acct.${addr}.${key}`
}

export function loadAccount<T>(addr: string, key: AccountKey, fallback: T): T {
  return loadJSON<T>(accountKey(addr, key), fallback)
}

export function saveAccount<T>(addr: string, key: AccountKey, value: T): void {
  saveJSON(accountKey(addr, key), value)
}

/** Migration unique : les clés globales héritées appartiennent au premier compte
 * qui se connecte après la mise à jour. Copiées dans sa partition puis supprimées
 * pour qu'un second compte démarre vierge. Idempotent. */
export function migrateAccount(addr: string): void {
  for (const key of ACCOUNT_KEYS) {
    const target = accountKey(addr, key)
    if (localStorage.getItem(PREFIX + target) !== null) continue
    const legacy = localStorage.getItem(PREFIX + key)
    if (legacy === null) continue
    localStorage.setItem(PREFIX + target, legacy)
    localStorage.removeItem(PREFIX + key)
  }
}
