// Bornes anti-abus du relay : constantes lues depuis l'env + helpers token bucket et tailles.
// Toutes configurables par variable d'env, défauts sains. Aucune lecture de payload.

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ENVELOPE_TTL_DAYS = envInt("RELAY_ENVELOPE_TTL_DAYS", 7);
export const MAX_QUEUE_PER_ADDR = envInt("RELAY_MAX_QUEUE_PER_ADDR", 500);
export const MAX_PAYLOAD_BYTES = envInt("RELAY_MAX_PAYLOAD_BYTES", 65536);
export const MAX_BACKUP_BYTES = envInt("RELAY_MAX_BACKUP_BYTES", 1048576);
export const RATE_PER_SEC = envInt("RELAY_RATE_PER_SEC", 30);
export const MAX_ADDRESSES = envInt("RELAY_MAX_ADDRESSES", 10000);

export const ENVELOPE_TTL_MS = ENVELOPE_TTL_DAYS * 24 * 60 * 60 * 1000;
export const TTL_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export function payloadBytes(payload: string): number {
  return Buffer.byteLength(payload, "utf8");
}

export interface TokenBucket {
  tokens: number;
  last: number;
}

export function createBucket(): TokenBucket {
  return { tokens: RATE_PER_SEC, last: Date.now() };
}

// Refill paresseux puis consommation d'un token. Retourne false si dépassement.
export function consumeToken(bucket: TokenBucket): boolean {
  const now = Date.now();
  const elapsed = (now - bucket.last) / 1000;
  bucket.last = now;
  bucket.tokens = Math.min(RATE_PER_SEC, bucket.tokens + elapsed * RATE_PER_SEC);
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}
