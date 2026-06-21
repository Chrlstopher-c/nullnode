import sodium from 'libsodium-wrappers-sumo'
import { ensureReady } from '../../crypto/identity'

/** Vault chiffré at-rest pour la mnemonic — clé dérivée d'un PIN via crypto_pwhash. */
export interface VaultBlob {
  v: 1
  salt: string
  nonce: string
  cipher: string
}

/** Dérive une clé secretbox depuis le PIN et un sel. Les constantes sodium sont lues
 * à l'appel (après ensureReady) : au top-level du module elles sont encore undefined. */
function deriveKey(pin: string, salt: Uint8Array): Uint8Array {
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES, pin, salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  )
}

/** Vérifie qu'un objet inconnu est un VaultBlob v1 valide. */
export function isVaultBlob(value: unknown): value is VaultBlob {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v.v === 1
    && typeof v.salt === 'string'
    && typeof v.nonce === 'string'
    && typeof v.cipher === 'string'
}

/** Chiffre la mnemonic avec une clé dérivée du PIN. Sel et nonce aléatoires. */
export async function sealSeed(mnemonic: string, pin: string): Promise<VaultBlob | null> {
  try {
    await ensureReady()
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    const key = deriveKey(pin, salt)
    const cipher = sodium.crypto_secretbox_easy(sodium.from_string(mnemonic), nonce, key)
    return {
      v: 1,
      salt: sodium.to_base64(salt),
      nonce: sodium.to_base64(nonce),
      cipher: sodium.to_base64(cipher),
    }
  } catch (err) {
    console.error('[vault] seal failed', err)
    return null
  }
}

/** Déchiffre la mnemonic. Retourne null si PIN faux ou blob corrompu — ne throw jamais. */
export async function openSeed(blob: VaultBlob, pin: string): Promise<string | null> {
  try {
    await ensureReady()
    const salt = sodium.from_base64(blob.salt)
    const nonce = sodium.from_base64(blob.nonce)
    const cipher = sodium.from_base64(blob.cipher)
    const key = deriveKey(pin, salt)
    const plain = sodium.crypto_secretbox_open_easy(cipher, nonce, key)
    return sodium.to_string(plain)
  } catch (err) {
    console.error('[vault] open failed (wrong pin or corrupt blob)', err)
    return null
  }
}
