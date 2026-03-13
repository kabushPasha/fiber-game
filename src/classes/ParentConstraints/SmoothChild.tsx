import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useGameObject3D } from "../GameObjectContext";
import { HeadBob } from "../Player/HeadBob";
import { LateralTilt } from "../Player/LateralTilt";




type SmoothChildProps = React.PropsWithChildren<{
  smooth?: number
  smoothX?: boolean
  smoothY?: boolean
  smoothZ?: boolean
}>

export function SmoothChild({
  smooth = 16,
  smoothX = false,
  smoothY = true,
  smoothZ = false,
  children
}: SmoothChildProps) {
  const { objectRef } = useGameObject3D()
  const { scene } = useThree()

  const groupRef = useRef<THREE.Group>(null!)

  const parentWorld = new THREE.Vector3()
  const worldPos = new THREE.Vector3()

  useEffect(() => {
    const g = groupRef.current
    if (!g) return

    g.updateWorldMatrix(true, false)
    g.getWorldPosition(worldPos)

    scene.add(g)
    g.position.copy(worldPos)

    return () => {
      scene.remove(g)
    }
  }, [scene])

  useFrame((_, delta) => {
    const parent = objectRef.current
    const g = groupRef.current
    if (!parent || !g) return

    parent.getWorldPosition(parentWorld)

    // apply smoothing only if axis toggle is true
    worldPos.x = smoothX
      ? THREE.MathUtils.damp(g.position.x, parentWorld.x, smooth, delta)
      : parentWorld.x
    worldPos.y = smoothY
      ? THREE.MathUtils.damp(g.position.y, parentWorld.y, smooth, delta)
      : parentWorld.y
    worldPos.z = smoothZ
      ? THREE.MathUtils.damp(g.position.z, parentWorld.z, smooth, delta)
      : parentWorld.z

    g.position.copy(worldPos)

    // Copy Rotation
    const orient = new THREE.Quaternion();
    parent.getWorldQuaternion(orient);
    g.setRotationFromQuaternion(orient);
  })

  return <group ref={groupRef}>{children}</group>
}




type SmoothCameraProps = {
  smooth?: number
}

export function SmoothCamera({ smooth = 6 }: SmoothCameraProps) {
  const { camera } = useThree()

  return (
    <SmoothChild smooth={smooth}>
      <HeadBob>
        <LateralTilt maxTilt={0.15} damping={6}>
            <primitive object={camera} position={[0,0,30]} />
        </LateralTilt>
      </HeadBob>
    </SmoothChild>
  )
}

