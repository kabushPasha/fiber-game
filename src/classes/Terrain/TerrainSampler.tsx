import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useTerrain } from "./TerrainProvider";
import { useGameObject3D } from "../GameObjectContext";


export function TerrainSampler() {
  const terrain = useTerrain();
  const groupRef = useRef<THREE.Group>(null);
  const worldPos = new THREE.Vector3();

  useFrame(() => {
    if (!terrain || !groupRef.current) return;

    const parent = groupRef.current.parent;
    if (!parent) return;

    parent.getWorldPosition(worldPos);
    parent.position.y = terrain.getHeightAtPos(worldPos);
  });

  return <group ref={groupRef} />;
}


/*
export function SmoothCamera({ smooth = 16 }) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null!);

  const worldPos = new THREE.Vector3()  
  const camWorldPos = new THREE.Vector3()  

  useFrame((_, delta) => {    
    groupRef.current.getWorldPosition(worldPos);
    camera.getWorldPosition(camWorldPos);

    worldPos.y = THREE.MathUtils.damp(camWorldPos.y, worldPos.y, smooth, delta);
    camera.position.copy(worldPos); 
  })

  return <group ref={groupRef} position={[0,1.75,0]}/>
}
*/


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
  })

  return <group ref={groupRef}>{children}</group>
}

type SmoothCameraProps = {
  smooth?: number
  offset?: [number, number, number]
}

export function SmoothCamera({ smooth = 6, offset = [0, 1.75, 0] }: SmoothCameraProps) {
  const { camera } = useThree()

  return (
    <SmoothChild smooth={smooth}>
      <HeadBob>
        <group position={offset}>
          <primitive object={camera} />
        </group>
      </HeadBob>
    </SmoothChild>
  )
}


type HeadBobProps = {
  standingAmplitude?: number
  standingFrequency?: number
  runningAmplitude?: number
  runningFrequency?: number
  blendSpeed?: number
  children?: ReactNode
}

export function HeadBob({
  standingAmplitude = 0.1,
  standingFrequency = 0.2,
  runningAmplitude = 0.2,
  runningFrequency = 2,
  blendSpeed = 8,
  children
}: HeadBobProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const offset = useRef(0)
  const blend = useRef(0) // 0 = standing, 1 = running

  const { objectRef } = useGameObject3D()

  useFrame((_, delta) => {

    const g = groupRef.current
    if (!g) return

    // compute target blend from velocity
    const targetBlend = objectRef.current.userData.is_moving || 0;


    blend.current = THREE.MathUtils.damp(blend.current, targetBlend, blendSpeed, delta)

    // advance offset
    offset.current += delta * Math.PI * 2

    // compute y for standing and running separately
    const yStanding = Math.sin(offset.current * standingFrequency) * standingAmplitude
    const yRunning = Math.sin(offset.current * runningFrequency) * runningAmplitude

    // blend final position
    g.position.y = THREE.MathUtils.lerp(yStanding, yRunning, blend.current)

  })

  return <group ref={groupRef}>{children}</group>
}