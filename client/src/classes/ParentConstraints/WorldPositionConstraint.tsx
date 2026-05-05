import * as THREE from "three"
import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGameObject3D } from "../GameObjectContext"


type WorldPositionConstraintProps = React.PropsWithChildren<{}>

export function WorldPositionConstraint({ children }: WorldPositionConstraintProps) {
  const { objectRef } = useGameObject3D()
  const { scene } = useThree()

  const groupRef = useRef<THREE.Group>(null!)
  const parentWorld = new THREE.Vector3()

  // Detach group from hierarchy but maintain world position
  useEffect(() => {
    const g = groupRef.current
    if (!g) return

    g.updateWorldMatrix(true, false)
    g.getWorldPosition(parentWorld)

    scene.add(g)
    g.position.copy(parentWorld)

    return () => {
      scene.remove(g)
    }
  }, [scene])

  // Each frame, copy parent's world position only
  useFrame(() => {
    const parent = objectRef.current
    const g = groupRef.current
    if (!parent || !g) return

    parent.getWorldPosition(parentWorld)
    g.position.copy(parentWorld)
  },-5)

  return <group ref={groupRef}>{children}</group>
}