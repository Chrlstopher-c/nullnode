// Réglages visuels persistants (densité particules, grain, aberration, thème d'accent).
// Local-first : stockés dans localStorage, clé `nullnode.visual` via le wrapper partagé.

import { loadJSON, saveJSON } from '../shared/local-store'

const KEY = 'visual'

export type AccentTheme = 'phosphor' | 'amber'

export interface VisualConfig {
  particleDensity: number // 0.3..1.5, défaut 1
  grain: number // 0..0.4, défaut 0.18
  aberration: number // 0..2, défaut 1 (multiplicateur de l'offset de base)
  accent: AccentTheme // défaut 'phosphor'
}

export const DEFAULT_VISUAL: VisualConfig = { particleDensity: 1, grain: 0.18, aberration: 1, accent: 'phosphor' }

export const ACCENT_THEMES: Record<AccentTheme, { accent: string; dim: string; glow: string }> = {
  phosphor: { accent: '#00ff9d', dim: '#0b9e68', glow: 'rgba(0,255,157,0.45)' },
  amber: { accent: '#ffb020', dim: '#b8791a', glow: 'rgba(255,176,32,0.45)' },
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function sanitize(raw: Partial<VisualConfig>): VisualConfig {
  const accent: AccentTheme = raw.accent === 'amber' ? 'amber' : 'phosphor'
  return {
    particleDensity: clamp(raw.particleDensity ?? DEFAULT_VISUAL.particleDensity, 0.3, 1.5),
    grain: clamp(raw.grain ?? DEFAULT_VISUAL.grain, 0, 0.4),
    aberration: clamp(raw.aberration ?? DEFAULT_VISUAL.aberration, 0, 2),
    accent,
  }
}

/** Charge la config persistée, fusionnée avec les défauts et clampée. */
export function loadVisual(): VisualConfig {
  try {
    const stored = loadJSON<Partial<VisualConfig>>(KEY, {})
    return sanitize({ ...DEFAULT_VISUAL, ...stored })
  } catch (err) {
    console.error('[visual] load failed', err)
    return { ...DEFAULT_VISUAL }
  }
}

/** Persiste la config (déjà clampée par le hook). */
export function saveVisual(cfg: VisualConfig): void {
  try {
    saveJSON(KEY, cfg)
  } catch (err) {
    console.error('[visual] save failed', err)
  }
}
