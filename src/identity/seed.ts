import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import sodium from 'libsodium-wrappers-sumo'
import { ensureReady, deriveFingerprint } from '../crypto/identity'
import type { Identity } from '../shared/types'

/** Génère une phrase de récupération de 12 mots (128 bits d'entropie). */
export function newMnemonic(): string {
  return generateMnemonic(wordlist, 128)
}

/** Valide une phrase de récupération BIP39. */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim().toLowerCase(), wordlist)
}

/** Dérive l'identité X25519 de façon déterministe depuis la phrase. */
export async function identityFromMnemonic(mnemonic: string): Promise<Identity> {
  await ensureReady()
  const full = mnemonicToSeedSync(mnemonic.trim().toLowerCase())
  const seed = full.slice(0, sodium.crypto_kx_SEEDBYTES)
  const pair = sodium.crypto_kx_seed_keypair(seed)
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    fingerprint: deriveFingerprint(pair.publicKey),
  }
}
