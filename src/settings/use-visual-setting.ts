import { useCallback, useEffect, useState } from 'react'
import { ACCENT_THEMES, loadVisual, saveVisual } from './visual-config'
import type { VisualConfig } from './visual-config'

export interface VisualSetting {
  visual: VisualConfig
  setVisual: (patch: Partial<VisualConfig>) => void
}

/** Réglages visuels persistés. L'accent applique aussi les CSS vars sur <html>, reskinant l'UI 2D. */
export function useVisualSetting(): VisualSetting {
  const [visual, setState] = useState<VisualConfig>(() => loadVisual())

  const setVisual = useCallback((patch: Partial<VisualConfig>): void => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      saveVisual(next)
      return next
    })
  }, [])

  useEffect(() => {
    const theme = ACCENT_THEMES[visual.accent]
    const root = document.documentElement.style
    root.setProperty('--accent', theme.accent)
    root.setProperty('--accent-dim', theme.dim)
    root.setProperty('--accent-glow', theme.glow)
  }, [visual.accent])

  return { visual, setVisual }
}
