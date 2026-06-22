import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ACCENT, buildParticleShell } from './network-core'
import { PARTICLE_FRAGMENT, PARTICLE_VERTEX } from './shaders'

interface LayerProps {
  count: number
  rMin: number
  rMax: number
  size: number
  spin: number
  color?: THREE.Color
}

function makeMaterial(size: number, color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uSize: { value: size },
      uPixel: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: PARTICLE_VERTEX,
    fragmentShader: PARTICLE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

/** One additive point layer (dust shell or distant starfield). */
function ParticleLayer({ count, rMin, rMax, size, spin, color = ACCENT }: LayerProps): React.ReactElement {
  const ref = useRef<THREE.Points>(null)
  const { positions, seeds, scales } = useMemo(() => buildParticleShell(count, rMin, rMax), [count, rMin, rMax])
  const material = useMemo(() => makeMaterial(size, color), [size, color])

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
    if (ref.current) {
      ref.current.rotation.y += dt * spin
      ref.current.rotation.x += dt * spin * 0.3
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  )
}

interface FieldProps {
  density: number
  accentColor?: THREE.Color
  dimColor?: THREE.Color
}

const MID_COLOR = new THREE.Color('#0b9e68')
const FAR_COLOR = new THREE.Color('#16312a')

/** Layered particle atmosphere: inner dust shell + drifting mid field + distant stars. */
export function ParticleField({ density, accentColor = ACCENT }: FieldProps): React.ReactElement {
  const scaled = (count: number): number => Math.round(count * density)
  return (
    <>
      <ParticleLayer count={scaled(2200)} rMin={1.6} rMax={4.2} size={90} spin={0.06} color={accentColor} />
      <ParticleLayer count={scaled(1400)} rMin={4.5} rMax={8} size={60} spin={-0.025} color={MID_COLOR} />
      <ParticleLayer count={scaled(1200)} rMin={9} rMax={16} size={40} spin={0.01} color={FAR_COLOR} />
    </>
  )
}
