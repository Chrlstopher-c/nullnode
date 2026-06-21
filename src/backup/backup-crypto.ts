// Backup zero-knowledge : scelle l'état utilisateur dans un blob chiffré par clé dérivée de la seed BIP39.
import { mnemonicToSeedSync } from '@scure/bip39'
import sodium from 'libsodium-wrappers-sumo'
import { ensureReady } from '../crypto/identity'

export interface BackupState {
  roster: unknown
  history: unknown
  seen: unknown
  pseudo: string
}

const KDF_CONTEXT = 'nullnode-backup-v1'

/** Dérive une clé secretbox dédiée au backup, indépendante de la keypair X25519. */
function deriveBackupKey(mnemonic: string): Uint8Array {
  const seedBytes = mnemonicToSeedSync(mnemonic.trim().toLowerCase())
  return sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    seedBytes,
    sodium.from_string(KDF_CONTEXT),
  )
}

/** Sérialise et chiffre l'état → blob base64 (nonce || ciphertext). */
export async function sealBackup(state: BackupState, mnemonic: string): Promise<string> {
  await ensureReady()
  try {
    const key = deriveBackupKey(mnemonic)
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    const message = sodium.from_string(JSON.stringify(state))
    const cipher = sodium.crypto_secretbox_easy(message, nonce, key)
    return sodium.to_base64(new Uint8Array([...nonce, ...cipher]))
  } catch (err) {
    console.error('[backup] seal failed', err)
    throw err
  }
}

/** Déchiffre un blob → état, ou null si seed erronée / blob corrompu. */
export async function openBackup(blob: string, mnemonic: string): Promise<BackupState | null> {
  await ensureReady()
  try {
    const key = deriveBackupKey(mnemonic)
    const combined = sodium.from_base64(blob)
    const nbytes = sodium.crypto_secretbox_NONCEBYTES
    const nonce = combined.slice(0, nbytes)
    const cipher = combined.slice(nbytes)
    const plain = sodium.crypto_secretbox_open_easy(cipher, nonce, key)
    // JSON.parse renvoie un type structurel conforme à BackupState par construction de sealBackup.
    return JSON.parse(sodium.to_string(plain)) as BackupState
  } catch (err) {
    console.error('[backup] open failed', err)
    return null
  }
}
