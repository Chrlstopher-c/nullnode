import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { TopologyEngine, type TopologySnapshot } from './topology-engine'

export interface NetworkCanvasHandle {
  pulse: (peerId: string) => void
  setPaused: (paused: boolean) => void
}

interface Props {
  snapshot: TopologySnapshot
  reducedMotion: boolean
}

/** Pont React ⇆ moteur 2D : pousse l'état réel en snapshot, expose pulse() en impératif. */
export const NetworkCanvas = forwardRef<NetworkCanvasHandle, Props>(function NetworkCanvas(
  { snapshot, reducedMotion },
  ref,
): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<TopologyEngine | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new TopologyEngine(canvasRef.current)
    engineRef.current = engine
    return () => { engine.destroy(); engineRef.current = null }
  }, [])

  useEffect(() => { engineRef.current?.sync(snapshot) }, [snapshot])
  useEffect(() => { if (engineRef.current) engineRef.current.reducedMotion = reducedMotion }, [reducedMotion])

  useImperativeHandle(ref, () => ({
    pulse: (peerId: string): void => engineRef.current?.pulse(peerId),
    setPaused: (paused: boolean): void => engineRef.current?.setPaused(paused),
  }), [])

  return <canvas ref={canvasRef} className="ws-canvas" />
})
