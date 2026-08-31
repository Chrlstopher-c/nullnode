// Source du node de rendez-vous, configurable et persistée. Priorité :
// override utilisateur (localStorage) > variable d'env build > défaut local.
//
// `☠` AUCUNE adresse réelle en dur ici. Ce fichier est public : une adresse de
// relai écrite dans le dépôt, c'est l'adresse de la machine de quelqu'un,
// publiée et indexée pour toujours. Les presets viennent de l'environnement de
// build (`.env.local`, jamais suivi) et la liste est vide par défaut.

import { loadJSON, saveJSON } from '../shared/local-store'

const KEY = 'relay-url'
const ENV_URL = import.meta.env.VITE_RELAY_URL as string | undefined
const ENV_PRESETS = import.meta.env.VITE_RELAY_PRESETS as string | undefined
const DEFAULT_LOCAL = 'ws://127.0.0.1:8791'

export interface RelayPreset {
  label: string
  url: string
}

const PRESET_LOCAL: RelayPreset = { label: 'Local', url: DEFAULT_LOCAL }

/** Une entrée acceptée : `Libellé=ws://hôte:port`, séparées par des virgules. */
const MOTIF_PRESET = /^([^=]{1,32})=(wss?:\/\/[^\s,]{1,200})$/

/**
 * Lit `VITE_RELAY_PRESETS` et refuse toute entrée mal formée au lieu de la
 * laisser arriver dans l'interface : une URL de relai est une cible réseau, pas
 * un libellé décoratif.
 */
export function parsePresets(brut: string | undefined): RelayPreset[] {
  if (!brut) return []
  const presets: RelayPreset[] = []
  for (const entree of brut.split(',')) {
    const nettoyee = entree.trim()
    if (!nettoyee) continue
    const trouve = MOTIF_PRESET.exec(nettoyee)
    if (!trouve) {
      console.warn(
        `[relay] preset ignoré : "${nettoyee}" — attendu « Libellé=ws://hôte:port » ou « Libellé=wss://hôte ».`,
      )
      continue
    }
    presets.push({ label: trouve[1].trim(), url: trouve[2] })
  }
  return presets
}

/** Presets proposés dans les Réglages : ceux de l'environnement, puis le local. */
export const RELAY_PRESETS: RelayPreset[] = [...parsePresets(ENV_PRESETS), PRESET_LOCAL]

/** URL active : override utilisateur, sinon env de build, sinon défaut local. */
export function loadRelayUrl(): string {
  const saved = loadJSON<string>(KEY, '')
  return saved || ENV_URL || DEFAULT_LOCAL
}

export function saveRelayUrl(url: string): void {
  saveJSON(KEY, url.trim())
}
