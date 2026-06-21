import sodium from 'libsodium-wrappers-sumo'

const PREFIX = 'null:'
const VARIANT = () => sodium.base64_variants.URLSAFE_NO_PADDING

// 64-word callsign list — a friendly, human-recognizable label for a public key.
const WORDS = [
  'ARC', 'BOLT', 'CIPHER', 'DELTA', 'ECHO', 'FLUX', 'GLYPH', 'HALO',
  'IRON', 'JADE', 'KILO', 'LUMEN', 'MIRAGE', 'NOVA', 'ONYX', 'PULSE',
  'QUARTZ', 'RIFT', 'SABLE', 'TERRA', 'UMBRA', 'VECTOR', 'WRAITH', 'XENON',
  'YOKE', 'ZEPHYR', 'ASH', 'BRINE', 'CREST', 'DUSK', 'EMBER', 'FROST',
  'GROVE', 'HOLLOW', 'IGNIS', 'JET', 'KORE', 'LATCH', 'MARROW', 'NULL',
  'ORBIT', 'PRISM', 'QUILL', 'RAVEN', 'SLATE', 'TIDE', 'USHER', 'VIGIL',
  'WARDEN', 'XYLO', 'YARROW', 'ZINC', 'ATLAS', 'BASTION', 'CINDER', 'DRIFT',
  'ELM', 'FORGE', 'GALE', 'HEX', 'INDIGO', 'JOLT', 'KESTREL', 'LOOM',
]

/** Encode a public key into the shareable NULLNODE address. */
export function encodeAddress(publicKey: Uint8Array): string {
  return PREFIX + sodium.to_base64(publicKey, VARIANT())
}

/** Decode + validate a NULLNODE address back into a public key. */
export function decodeAddress(address: string): Uint8Array {
  const body = address.trim().replace(PREFIX, '')
  const key = sodium.from_base64(body, VARIANT())
  if (key.length !== sodium.crypto_kx_PUBLICKEYBYTES) throw new Error('INVALID_ADDRESS')
  return key
}

/** Derive a stable, friendly 3-word callsign from a public key (display only). */
export function callsign(publicKey: Uint8Array): string {
  const hash = sodium.crypto_generichash(6, publicKey)
  return [0, 2, 4].map((i) => WORDS[hash[i] % WORDS.length]).join('-')
}

/** Derive a stable 6-digit discriminator from a public key — distinguishes homonyms. */
export function discriminator(publicKey: Uint8Array): string {
  const hash = sodium.crypto_generichash(4, publicKey)
  const num = ((hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3]) >>> 0
  return String(num % 1_000_000).padStart(6, '0')
}

/** Full display handle: PSEUDO#123456. The discriminator is bound to the key. */
export function handle(pseudo: string, publicKey: Uint8Array): string {
  const clean = pseudo.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16) || 'OPERATOR'
  return `${clean}#${discriminator(publicKey)}`
}
