import sodium from 'libsodium-wrappers-sumo'
import { ensureReady } from '../crypto/identity'
import type { Identity } from '../shared/types'

// crypto_box_seal attend des clés X25519 box. Nos keypairs viennent de
// crypto_kx_keypair (déjà X25519), donc identity.publicKey / privateKey
// sont directement compatibles avec crypto_box_seal / crypto_box_seal_open.

export interface SignalBody {
  kind: 'offer' | 'answer'
  sdp: RTCSessionDescriptionInit
}

/** Garantit que libsodium est initialisé avant tout usage. */
export async function ensureSealReady(): Promise<void> {
  await ensureReady()
}

/** Scelle un blob de signaling vers la clé publique du destinataire (relai aveugle). */
export function sealSignal(body: SignalBody, recipientPub: Uint8Array): string {
  try {
    const msg = sodium.from_string(JSON.stringify(body))
    const cipher = sodium.crypto_box_seal(msg, recipientPub)
    return sodium.to_base64(cipher)
  } catch (err) {
    console.error('[rendezvous] sealSignal failed', err)
    throw new Error('SEAL_FAILED')
  }
}

/** Ouvre un blob de signaling scellé avec sa propre keypair. */
export function openSignal(payloadB64: string, self: Identity): SignalBody {
  try {
    const cipher = sodium.from_base64(payloadB64)
    const plain = sodium.crypto_box_seal_open(cipher, self.publicKey, self.privateKey)
    // as SignalBody : JSON.parse renvoie any ; structure garantie par sealSignal côté émetteur.
    return JSON.parse(sodium.to_string(plain)) as SignalBody
  } catch (err) {
    console.error('[rendezvous] openSignal failed', err)
    throw new Error('OPEN_FAILED')
  }
}
