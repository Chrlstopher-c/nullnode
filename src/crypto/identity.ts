import sodium from 'libsodium-wrappers-sumo'

let ready: Promise<void> | null = null

function ensureReady(): Promise<void> {
  if (!ready) ready = sodium.ready
  return ready
}

/** Short, human-readable fingerprint of a public key (HUD display). */
function deriveFingerprint(publicKey: Uint8Array): string {
  const hash = sodium.crypto_generichash(8, publicKey)
  const hex = sodium.to_hex(hash).toUpperCase()
  return hex.match(/.{1,4}/g)?.join(' ') ?? hex
}

export { ensureReady, deriveFingerprint }
