// Source du node de rendez-vous, configurable et persistée. Priorité :
// override utilisateur (localStorage) > variable d'env build > défaut Pi public.

import { loadJSON, saveJSON } from '../shared/local-store'

const KEY = 'relay-url'
const ENV_URL = import.meta.env.VITE_RELAY_URL as string | undefined
// Défaut dev = node local. Le Pi public reste accessible en 1 clic via les presets / settings.
const DEFAULT_LOCAL = 'ws://127.0.0.1:8791'

export interface RelayPreset {
  label: string
  url: string
}

export const RELAY_PRESETS: RelayPreset[] = [
  { label: 'Pi (public)', url: 'wss://relai.exemple' },
  { label: 'Pi (LAN)', url: 'ws://10.0.0.2:8791' },
  { label: 'Local', url: 'ws://127.0.0.1:8791' },
]

/** URL active : override utilisateur, sinon env de build, sinon défaut local. */
export function loadRelayUrl(): string {
  const saved = loadJSON<string>(KEY, '')
  return saved || ENV_URL || DEFAULT_LOCAL
}

export function saveRelayUrl(url: string): void {
  saveJSON(KEY, url.trim())
}
