// Hook de câblage du handoff GUI ↔ daemon, côté JS.
// - configure_presence dès que l'identité est prête (address + relayUrl).
// - guiOpened() au mount (la GUI est visible → elle prend la présence).
// - guiClosed() quand la fenêtre se masque (close-to-hide Rust) → le daemon réouvre.
//
// Détection show/hide retenue (la plus fiable en Tauri 2, documentée dans le README) :
// le Rust intercepte la fermeture en `hide()` ; côté JS l'event `tauri://close-requested`
// se déclenche AVANT ce hide → on y appelle guiClosed(). La réouverture via le tray
// rend la fenêtre visible et redéclenche le focus → on appelle guiOpened() sur
// `onFocusChanged(focused=true)` après un masquage. Aucune dépendance à un event "show"
// natif (inexistant), ce qui évite les faux négatifs.

import { useEffect, useRef } from 'react'
import { configurePresence, guiOpened, guiClosed, isTauri } from './tauri-bridge'

interface Args {
  ready: boolean
  address: string
  relayUrl: string
}

/** Établit la présence desktop et maintient le handoff au fil de vie de la fenêtre. */
export function useDesktopPresence({ ready, address, relayUrl }: Args): void {
  const hiddenRef = useRef(false)

  useEffect(() => {
    if (!ready || !address || !relayUrl) return
    void configurePresence(address, relayUrl)
  }, [ready, address, relayUrl])

  useEffect(() => {
    if (!isTauri()) return
    let unlistenClose: (() => void) | undefined
    let unlistenFocus: (() => void) | undefined
    let cancelled = false

    const wire = async (): Promise<void> => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        // Au mount la fenêtre est visible : la GUI tient la présence.
        await guiOpened()

        unlistenClose = await win.onCloseRequested(() => {
          hiddenRef.current = true
          void guiClosed()
        })
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          if (focused && hiddenRef.current) {
            hiddenRef.current = false
            void guiOpened()
          }
        })
      } catch (err) {
        console.error('[desktop-presence] câblage fenêtre échoué', err)
      }
    }

    void wire().then(() => {
      if (cancelled) {
        unlistenClose?.()
        unlistenFocus?.()
      }
    })
    return () => {
      cancelled = true
      unlistenClose?.()
      unlistenFocus?.()
    }
  }, [])
}
