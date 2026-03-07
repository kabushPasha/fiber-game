import { useRef, type ReactNode } from "react"
import { useGameObject3D } from "../GameObjectContext"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"



type HeadBobProps = {
  maxSpeed?: number

  walkAmplitude?: number
  runAmplitude?: number

  swayAmplitude?: number
  rollAmplitude?: number

  walkStepLength?: number
  runStepLength?: number

  blendSpeed?: number

  idleAmplitude?: number
  idleFrequency?: number

  children?: ReactNode
}

export function HeadBob({
  maxSpeed = 24,

  walkAmplitude = 0.1,
  runAmplitude = 0.2,

  swayAmplitude = 0.2,
  rollAmplitude = 0.02,

  walkStepLength = 10,
  runStepLength = 15,

  blendSpeed = 10,

  idleAmplitude = 0.1,
  idleFrequency = 0.25,

  children
}: HeadBobProps) {

  const groupRef = useRef<THREE.Group>(null!)

  const phase = useRef(0)
  const idlePhase = useRef(0)
  const blend = useRef(0)

  const { objectRef } = useGameObject3D()

  useFrame((_, delta) => {

    const g = groupRef.current
    if (!g) return

    const vel: THREE.Vector3 = objectRef.current.parent!.userData.vel ??= new THREE.Vector3(0, 0, 0)

    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)
    // normalize speed
    const targetBlend = THREE.MathUtils.clamp(speed / maxSpeed, 0, 1)
    blend.current = THREE.MathUtils.damp(blend.current, targetBlend, blendSpeed, delta)

    // blend step length
    const stepLength = THREE.MathUtils.lerp(
      walkStepLength,
      runStepLength,
      blend.current
    )

    // step-synced phase
    if (speed > 0.01) {
      const distance = speed * delta
      phase.current += (distance / stepLength) * Math.PI * 2
    }

    idlePhase.current += delta * idleFrequency * Math.PI * 2

    //const sin = Math.sin(phase.current)
    const cos = Math.cos(phase.current)

    // amplitude scaling
    const amplitude = THREE.MathUtils.lerp(
      walkAmplitude,
      runAmplitude,
      blend.current
    )

    // vertical bob
    const yMove = Math.sin(phase.current * 2) * amplitude

    // side sway
    const xMove = cos * swayAmplitude * blend.current

    // camera roll
    const roll = cos * rollAmplitude * blend.current

    // idle breathing
    const idle =
      Math.sin(idlePhase.current) *
      idleAmplitude *
      (1 - blend.current)

    g.position.y = yMove + idle
    g.position.x = xMove

    g.rotation.z = roll
  })

  return <group ref={groupRef}>{children}</group>
}


