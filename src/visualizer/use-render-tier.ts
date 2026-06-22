import { useEffect, useRef, useState } from 'react'
import { hasAcceleratedWebGL } from './webgl-support'

const STORAGE_KEY = 'nullnode.renderTier.v2'
const MIN_FPS = 20
const WARMUP_MS = 600 // laisse compiler shaders + stabiliser avant de mesurer
const SAMPLE_MS = 1200

export type RenderTier = 'probing' | 'gpu' | 'software'

function persisted(): RenderTier | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'gpu' || v === 'software' ? v : null
}

/** Détermine si la machine peut afficher la scène 3D à un framerate décent. La string renderer
 * (WEBGL_debug_renderer_info) ment sous WebKitGTK/NVIDIA → on confirme par une mesure FPS réelle
 * pendant que le Canvas tourne. Verdict persisté : les lancements suivants sont instantanés. */
export function useRenderTier(): RenderTier {
  const [tier, setTier] = useState<RenderTier>(
    () => persisted() ?? (hasAcceleratedWebGL() ? 'probing' : 'software'),
  )
  const probe = useRef({ warmEnd: 0, sampleStart: 0, frames: 0 })

  useEffect(() => {
    if (tier !== 'probing') return
    let raf = 0
    const p = probe.current
    const tick = (t: number): void => {
      if (!p.warmEnd) p.warmEnd = t + WARMUP_MS
      else if (t >= p.warmEnd && !p.sampleStart) p.sampleStart = t
      else if (p.sampleStart) {
        p.frames += 1
        const elapsed = t - p.sampleStart
        if (elapsed >= SAMPLE_MS) {
          const verdict: RenderTier = (p.frames * 1000) / elapsed >= MIN_FPS ? 'gpu' : 'software'
          try { localStorage.setItem(STORAGE_KEY, verdict) } catch { /* quota indisponible */ }
          setTier(verdict)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tier])

  return tier
}
