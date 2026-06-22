import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart'] as const

/** Détecte l'inactivité utilisateur : `onIdle` après `idleMs` sans activité, `onActive` au retour.
 * Refs only — aucun re-render sur l'activité, listeners jamais re-bindés sur changement de callback. */
export function useIdle(idleMs: number, onIdle: () => void, onActive: () => void): void {
  const callbacks = useRef({ onIdle, onActive })
  callbacks.current = { onIdle, onActive }

  const idle = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function goIdle(): void {
      if (idle.current) return
      idle.current = true
      callbacks.current.onIdle()
    }

    function arm(): void {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(goIdle, idleMs)
    }

    function onActivity(): void {
      if (idle.current) { idle.current = false; callbacks.current.onActive() }
      arm()
    }

    function onVisibility(): void {
      if (document.hidden) { if (timer.current) clearTimeout(timer.current); goIdle() }
      else onActivity()
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    arm()

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [idleMs])
}
