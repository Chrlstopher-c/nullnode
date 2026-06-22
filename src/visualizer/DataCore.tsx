import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ACCENT } from './network-core'
import { CORE_FRAGMENT, CORE_VERTEX } from './shaders'

interface Props {
  active: boolean
  accentColor?: THREE.Color
}

/** Volumetric data-sphere: noise-displaced surface with a fresnel rim glow. */
export function DataCore({ active, accentColor = ACCENT }: Props): React.ReactElement {
  const groupRef = useRef<THREE.Group>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uActive: { value: 0 },
          uColor: { value: accentColor.clone() },
        },
        vertexShader: CORE_VERTEX,
        fragmentShader: CORE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    // uColor est typé IUniform (value: unknown) ; on l'a initialisé en THREE.Color juste au-dessus.
    ;(material.uniforms.uColor.value as THREE.Color).copy(accentColor)
  }, [material, accentColor])

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
    material.uniforms.uActive.value = THREE.MathUtils.lerp(
      material.uniforms.uActive.value as number, active ? 1 : 0, 0.05,
    )
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.08
      groupRef.current.rotation.x += dt * 0.03
    }
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.25, 24]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh scale={0.96}>
        <icosahedronGeometry args={[1.25, 6]} />
        <meshBasicMaterial color="#020403" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}
