import sodium from 'libsodium-wrappers-sumo'

/** A dead-drop bundles an SDP blob + the sender's public key into one copyable code. */
export interface DropPayload {
  kind: 'offer' | 'answer'
  sdp: RTCSessionDescriptionInit
  pub: Uint8Array
}

/** Encode a payload into a grouped, copy-paste friendly code string. */
export function encodeDrop(
  kind: DropPayload['kind'],
  sdp: RTCSessionDescriptionInit,
  pub: Uint8Array,
): string {
  const json = JSON.stringify({ kind, sdp, pub: sodium.to_base64(pub) })
  const code = sodium.to_base64(sodium.from_string(json))
  return code.match(/.{1,48}/g)?.join('\n') ?? code
}

/** Decode a (possibly line-wrapped) drop code back into a payload. */
export function decodeDrop(code: string): DropPayload {
  try {
    const clean = code.replace(/\s+/g, '')
    const json = sodium.to_string(sodium.from_base64(clean))
    const parsed = JSON.parse(json) as {
      kind: DropPayload['kind']
      sdp: RTCSessionDescriptionInit
      pub: string
    }
    return { kind: parsed.kind, sdp: parsed.sdp, pub: sodium.from_base64(parsed.pub) }
  } catch (err) {
    console.error('[transport] invalid drop code', err)
    throw new Error('INVALID_DROP_CODE')
  }
}
