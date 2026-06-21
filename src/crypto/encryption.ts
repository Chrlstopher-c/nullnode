import sodium from 'libsodium-wrappers-sumo'
import { ensureReady, deriveFingerprint } from './identity'
import type { Identity } from '../shared/types'

export interface SessionKeys {
  tx: Uint8Array
  rx: Uint8Array
  peerFingerprint: string
}

/** Derive a shared session from local identity + peer public key (X25519 KX). */
export async function deriveSession(
  self: Identity,
  peerPublicKey: Uint8Array,
  initiator: boolean,
): Promise<SessionKeys> {
  await ensureReady()
  const fn = initiator
    ? sodium.crypto_kx_client_session_keys
    : sodium.crypto_kx_server_session_keys
  const keys = fn(self.publicKey, self.privateKey, peerPublicKey)
  return {
    tx: keys.sharedTx,
    rx: keys.sharedRx,
    peerFingerprint: deriveFingerprint(peerPublicKey),
  }
}

/** Encrypt a UTF-8 message with ChaCha20-Poly1305; returns base64 + auth tag. */
export function seal(keys: SessionKeys, plaintext: string): { payload: string; tag: string } {
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES)
  const cipher = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
    sodium.from_string(plaintext), null, null, nonce, keys.tx,
  )
  const combined = new Uint8Array([...nonce, ...cipher])
  return { payload: sodium.to_base64(combined), tag: sodium.to_hex(cipher.slice(-4)).toUpperCase() }
}

/** Decrypt a base64 payload produced by seal(). */
export function open(keys: SessionKeys, payload: string): string {
  const combined = sodium.from_base64(payload)
  const npub = sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES
  const nonce = combined.slice(0, npub)
  const cipher = combined.slice(npub)
  const plain = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
    null, cipher, null, nonce, keys.rx,
  )
  return sodium.to_string(plain)
}
