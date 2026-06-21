import sodium from 'libsodium-wrappers-sumo'
import type { Identity } from '../shared/types'

// Réutilise crypto_box_seal (cf. sealed-signal.ts) : nos keypairs crypto_kx sont
// directement compatibles. Sert aux messages applicatifs store-and-forward.

export type SocialBody =
  | { kind: 'friend_request'; pseudo: string; address: string }
  | { kind: 'friend_accept'; pseudo: string; address: string }
  | { kind: 'friend_decline'; address: string }
  | { kind: 'profile'; pseudo: string; address: string }
  | { kind: 'dm'; id: string; body: string; at: number; address: string }

/** Scelle une enveloppe sociale vers la clé publique du destinataire. */
export function sealEnvelope(body: SocialBody, recipientPub: Uint8Array): string {
  try {
    const cipher = sodium.crypto_box_seal(sodium.from_string(JSON.stringify(body)), recipientPub)
    return sodium.to_base64(cipher)
  } catch (err) {
    console.error('[social] sealEnvelope failed', err)
    throw new Error('SEAL_FAILED')
  }
}

/** Ouvre une enveloppe sociale avec sa propre keypair. */
export function openEnvelope(payloadB64: string, self: Identity): SocialBody {
  try {
    const cipher = sodium.from_base64(payloadB64)
    const plain = sodium.crypto_box_seal_open(cipher, self.publicKey, self.privateKey)
    // as SocialBody : JSON.parse renvoie any ; structure garantie par sealEnvelope.
    return JSON.parse(sodium.to_string(plain)) as SocialBody
  } catch (err) {
    console.error('[social] openEnvelope failed', err)
    throw new Error('OPEN_FAILED')
  }
}
