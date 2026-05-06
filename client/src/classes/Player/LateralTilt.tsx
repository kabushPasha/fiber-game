import { useRef, type ReactNode } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { usePlayer } from "./PlayerContext"

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
  const player = usePlayer()

  useFrame((_, delta) => {
    
    if (!player.player || !groupRef.current) return
    
    const vel: THREE.Vector3 = player.player!.userData.vel ?? new THREE.Vector3(0,0,0)

    // compute local lateral velocity (player right direction)
    const right = new THREE.Vector3(1,0,0).applyQuaternion(player.player!.quaternion)
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
