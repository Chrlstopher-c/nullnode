// Pont typé vers le daemon Tauri (couche Rust). Chaque wrapper no-op proprement hors
// Tauri (build web pur) : on détecte l'absence du runtime injecté et on sort en silence.
// Le daemon arbitre le handoff (le relay ne garde qu'UN socket par adresse).

import { invoke } from '@tauri-apps/api/core'

/** Présence du runtime Tauri : la clé interne n'existe que dans la webview Tauri. */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Appelle une commande Rust en absorbant l'erreur (le daemon est best-effort côté UI). */
async function safeInvoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke(cmd, args)
  } catch (err) {
    console.error(`[tauri-bridge] ${cmd} a échoué`, err)
  }
}

/** Persiste { address, relay_url } et (re)démarre le daemon si la GUI est fermée. */
export async function configurePresence(address: string, relayUrl: string): Promise<void> {
  if (!address || !relayUrl) return
  await safeInvoke('configure_presence', { address, relayUrl })
}

/** Signale l'ouverture de la GUI : le daemon ferme sa WS de présence (handoff vers le JS). */
export async function guiOpened(): Promise<void> {
  await safeInvoke('gui_opened')
}

/** Signale le masquage de la GUI : le daemon réouvre sa WS depuis la config persistée. */
export async function guiClosed(): Promise<void> {
  await safeInvoke('gui_closed')
}

export { isTauri }
