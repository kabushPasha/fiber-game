import * as THREE from "three"
import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"


type WorldPositionConstraintProps = React.PropsWithChildren<{}>

export function ParentWorldPositionConstraint({ children }: WorldPositionConstraintProps) {
  const { scene } = useThree()

  const groupRef = useRef<THREE.Group>(null!)
  const parentRef = useRef<THREE.Group>(null!)
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
    const parent = parentRef.current
    const g = groupRef.current
    if (!parent || !g) return

    parent.getWorldPosition(parentWorld)
    g.position.copy(parentWorld)

    //const parentOrient = new THREE.Quaternion()
    //parent.getWorldQuaternion(parentOrient)
    //g.rotation.setFromQuaternion(parentOrient)

  }, -5)

  return <group ref={parentRef}>
    <group ref={groupRef}>{children}</group>
  </group>
}