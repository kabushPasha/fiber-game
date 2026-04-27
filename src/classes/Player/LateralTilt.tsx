import { useRef, type ReactNode } from "react"
import { useGameObject3D } from "../GameObjectContext"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

type LateralTiltProps = {
  maxTilt?: number      // maximum tilt in radians
  damping?: number      // damping speed
  children?: ReactNode
}

export function LateralTilt({
  maxTilt = 0.15,       // ~8.5 degrees
  damping = 6,
  children
}: LateralTiltProps) {

  const groupRef = useRef<THREE.Group>(null!)
  const { objectRef: playerRef } = useGameObject3D()

  useFrame((_, delta) => {
    if (!playerRef.current || !groupRef.current) return
    const player = playerRef.current.parent!

    const vel: THREE.Vector3 = player.userData.vel ?? new THREE.Vector3(0,0,0)

    // compute local lateral velocity (player right direction)
    const right = new THREE.Vector3(1,0,0).applyQuaternion(player.quaternion)
    const lateralVel = vel.dot(right)  // positive = right, negative = left

    // target tilt
    const targetTilt = THREE.MathUtils.clamp(-lateralVel * 0.01, -maxTilt, maxTilt)

    // smooth tilt
    groupRef.current.rotation.z = THREE.MathUtils.damp(
      groupRef.current.rotation.z,
      targetTilt,
      damping,
      delta
    )
  })

  return <group ref={groupRef}>{children}</group>
}


type MaybeLateralTiltProps = LateralTiltProps & {
  enabled?: boolean
}
export function MaybeLateralTilt({
  enabled = true,
  children,
  ...props
}: MaybeLateralTiltProps) {
  if (!enabled) {
    return <group>{children}</group>
  }

  return <LateralTilt {...props}>{children}</LateralTilt>
}
