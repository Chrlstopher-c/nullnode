import sodium from 'libsodium-wrappers-sumo'
import type { SessionKeys } from './encryption'

// Wordlist NATO/tech (32 mots) pour le Short Authentication String — lecture de vive voix.
const SAS_WORDS = [
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
  'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA',
  'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VECTOR', 'WHISKEY', 'XRAY',
  'YANKEE', 'ZULU', 'AMBER', 'NORTH', 'CIPHER', 'ORBIT', 'PRISM', 'RAVEN',
]

const SAS_WORD_COUNT = 4

/** Compare deux Uint8Array octet par octet (ordre lexicographique). */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

/**
 * Dérive un Short Authentication String déterministe à comparer de vive voix.
 *
 * Symétrie : libsodium garantit `client.tx === server.rx` et `client.rx === server.tx`.
 * L'ENSEMBLE {tx, rx} est donc identique des deux côtés, seul l'ordre des rôles diffère.
 * En triant les deux clés par octets avant concaténation, l'input du hash devient
 * indépendant du rôle → le SAS est strictement identique chez les deux pairs.
 */
export function deriveSas(keys: SessionKeys): string {
  if (!keys.tx?.length || !keys.rx?.length) return ''
  const ordered = [keys.tx, keys.rx].sort(compareBytes)
  const concat = new Uint8Array([...ordered[0], ...ordered[1]])
  const hash = sodium.crypto_generichash(SAS_WORD_COUNT, concat, null)
  const words = Array.from({ length: SAS_WORD_COUNT }, (_, i) => SAS_WORDS[hash[i] % SAS_WORDS.length])
  return words.join('-')
}
