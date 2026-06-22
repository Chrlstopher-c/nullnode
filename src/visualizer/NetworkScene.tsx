import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { BloomEffect } from 'postprocessing'
import * as THREE from 'three'
import { buildNodePositions } from './network-core'
import { DataCore } from './DataCore'
import { ParticleField } from './ParticleField'
import { DataStreams } from './DataStreams'
import { ACCENT_THEMES } from '../settings/visual-config'
import type { VisualConfig } from '../settings/visual-config'
import type { ConnectionPhase } from '../shared/types'

const NODE_COUNT = 26
const CONNECTED_COUNT = 11
const RADIUS = 3.0
const PULSE_MS = 1400
const PULSE_GAIN = 1.3

interface SceneProps {
  phase: ConnectionPhase
  visual: VisualConfig
  pulseToken?: number
}

/** Slow cinematic dolly + bob around the core. */
function Rig(): React.ReactElement {
  useFrame((state) => {
    const t = state.clock.elapsedTime
    state.camera.position.x = Math.sin(t * 0.06) * 6.5
    state.camera.position.z = Math.cos(t * 0.06) * 6.5
    state.camera.position.y = Math.sin(t * 0.04) * 1.6
    state.camera.lookAt(0, 0, 0)
  })
  return <></>
}

interface BloomDriverProps {
  active: boolean
  bloomRef: React.RefObject<BloomEffect | null>
  pulseTime: React.RefObject<number>
}

/** Module l'intensité du Bloom via sa ref : pic puis decay à chaque impulsion (message/connexion).
 * Composant frère (hors EffectComposer, qui n'accepte que des primitives d'effet en enfants). */
function BloomDriver({ active, bloomRef, pulseTime }: BloomDriverProps): null {
  const activeRef = useRef(active)
  activeRef.current = active

  useFrame(() => {
    const eff = bloomRef.current
    if (!eff) return
    const base = activeRef.current ? 1.12 : 0.95
    const energy = Math.max(0, 1 - (performance.now() - pulseTime.current) / PULSE_MS)
    eff.intensity = base + energy * energy * PULSE_GAIN // ease-out quadratique sur le decay.
  })

  return null
}

export function NetworkScene({ phase, visual, pulseToken = 0 }: SceneProps): React.ReactElement {
  const nodes = useMemo(() => buildNodePositions(NODE_COUNT, RADIUS), [])
  const connected = useMemo(() => nodes.slice(0, CONNECTED_COUNT), [nodes])
  const active = phase === 'secure' || phase === 'handshaking'
  const secure = phase === 'secure'

  const theme = ACCENT_THEMES[visual.accent]
  const accentColor = useMemo(() => new THREE.Color(theme.accent), [theme.accent])
  const dimColor = useMemo(() => new THREE.Color(theme.dim), [theme.dim])
  const offset = useMemo(
    () => new THREE.Vector2(0.0009 * visual.aberration, 0.0012 * visual.aberration),
    [visual.aberration],
  )

  // Impulsion de luminescence : bump du timestamp à chaque nouvel événement, sauf au montage.
  const pulseTime = useRef(0)
  const mounted = useRef(false)
  const bloomRef = useRef<BloomEffect | null>(null)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    pulseTime.current = performance.now()
  }, [pulseToken])

  return (
    <Canvas camera={{ position: [0, 0, 6.5], fov: 52 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#040506']} />
      <fog attach="fog" args={['#040506', 7, 18]} />
      <DataCore active={active} accentColor={accentColor} />
      <ParticleField density={visual.particleDensity} accentColor={accentColor} dimColor={dimColor} />
      <DataStreams nodes={nodes} connected={connected} secure={secure} accentColor={accentColor} dimColor={dimColor} />
      <Rig />
      <BloomDriver active={active} bloomRef={bloomRef} pulseTime={pulseTime} />
      <EffectComposer>
        <Bloom ref={bloomRef} intensity={active ? 1.12 : 0.95} luminanceThreshold={0.08} luminanceSmoothing={0.3} mipmapBlur />
        <ChromaticAberration offset={offset} radialModulation modulationOffset={0.4} />
        <Vignette eskil={false} offset={0.28} darkness={0.92} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={visual.grain} />
      </EffectComposer>
    </Canvas>
  )
}
