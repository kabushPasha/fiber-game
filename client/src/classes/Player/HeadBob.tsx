import { useRef, type ReactNode } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { usePlayer } from "./PlayerContext"



type HeadBobProps = {
  enabled?: boolean
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
  enabled = true,
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
  const groundBlend = useRef(1)

  const lastVelY = useRef(0)
  const landingOffset = useRef(0)
  const landingTarget = useRef(0)

  const {player} = usePlayer();

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g ||!enabled || !player) return

    const vel: THREE.Vector3 = player.userData.vel ??= new THREE.Vector3(0, 0, 0)
    const groundDistance: number = player.userData.ground_distance ?? 0

    const targetGroundBlend = 1 - THREE.MathUtils.smoothstep(groundDistance, 0.1, .25)
    groundBlend.current = THREE.MathUtils.damp(
      groundBlend.current,
      targetGroundBlend,
      blendSpeed,
      delta
    )

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
    ) * groundBlend.current

    // vertical bob
    const yMove = Math.sin(phase.current * 2) * amplitude

    // side sway
    const xMove = cos * swayAmplitude * blend.current * groundBlend.current

    // camera roll
    const roll = cos * rollAmplitude * blend.current * groundBlend.current

    // idle breathing
    const idle =
      Math.sin(idlePhase.current) *
      idleAmplitude *
      (1 - blend.current)


    // Fall BOB --------------------------------
    const velY = player.userData.vel?.y ?? 0
    const deltaVelY = lastVelY.current - velY

    // Detect landing: big downward velocity stop near ground
    if (deltaVelY < -10 && velY === 0 && groundDistance <= 0.05) {
      // proportional to how fast we landed
      const impactStrength = THREE.MathUtils.clamp(-deltaVelY * 0.005, 0, 0.25) * 0 + 4
      landingTarget.current = impactStrength
    }

    // Smoothly damp landingOffset toward landingTarget
    landingOffset.current = THREE.MathUtils.damp(
      landingOffset.current,
      landingTarget.current,
      8, // higher = snappier, lower = softer
      delta
    )

    // Slowly decay the landingTarget itself so we don’t trigger instant again
    landingTarget.current = THREE.MathUtils.damp(
      landingTarget.current,
      0,
      6, // slower decay for smoother feel
      delta
    )
    lastVelY.current = velY


    // Finalize Offsets ---------------------
    g.position.y = yMove + idle - landingOffset.current
    g.position.x = xMove

    g.rotation.z = roll
  })

  return <group ref={groupRef}>{children}</group>
}


