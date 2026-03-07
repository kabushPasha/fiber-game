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

  walkAmplitude = 0.2,
  runAmplitude = 0.2,

  swayAmplitude = 0.2,
  rollAmplitude = 0.05,

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

    const vel = objectRef.current.userData.vel
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)

    // normalize speed
    const targetBlend = THREE.MathUtils.clamp(speed / maxSpeed, 0, 1)
    blend.current = THREE.MathUtils.damp(blend.current, targetBlend, blendSpeed, delta)
    console.log(targetBlend);

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

    const sin = Math.sin(phase.current)
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