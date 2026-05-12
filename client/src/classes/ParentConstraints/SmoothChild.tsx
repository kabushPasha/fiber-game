import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useGameObject3D } from "../GameObjectContext";
import { HeadBob } from "../Player/HeadBob";
import { MaybeLateralTilt } from "../Player/LateralTilt";
import { folder, useControls } from "leva";
import { OrthographicCamera } from "@react-three/drei";
import type { LZ_CamerOrientationControllerProps } from "../Player/CameraController";

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
  smooth?: number,
  defaultZ?: number,
}

export function LZ_PerspectiveCameraSmooth({
  smooth = 6,
  defaultZ = 0,
}: SmoothCameraProps) {

  const [controls, set] = useControls(() => ({
    Player: folder({
      Camera: folder({
        defaultZ: { value: defaultZ },
        fow: { value: 50 },
      }),
    }),
  }))

  useEffect(() => {
    set({ defaultZ });
  }, [defaultZ, set]);

  const { camera } = useThree()
  const targetZ = useRef(0) // target for smooth scroll

  useEffect(() => {
    (camera as THREE.PerspectiveCamera).fov = controls.fow;
    camera.updateProjectionMatrix()
  }, [controls.fow]);

  // update When Defaults Change
  useEffect(() => {
    targetZ.current = controls.defaultZ
    camera.position.z = controls.defaultZ
  }, [controls.defaultZ])

  // WHEEL ZOOM
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      targetZ.current += e.deltaY * 0.01 // adjust scroll speed
      targetZ.current = Math.max(0, targetZ.current) // clamp to positive Z
    }

    document.addEventListener("wheel", onWheel)
    return () => {
      document.removeEventListener("wheel", onWheel)
    }
  }, [])

  useFrame(() => {
    camera.position.z += (targetZ.current - camera.position.z) * 0.1 // smooth factor    
  })

  return (
    <>
      <SmoothChild smooth={smooth}>
        <HeadBob>
          <MaybeLateralTilt maxTilt={0.15} damping={6}>
            <primitive object={camera} />
          </MaybeLateralTilt>
        </HeadBob>
      </SmoothChild>
    </>
  )
}

type LZ_OrthoCameraProps = {
  smooth?: number,
  default_zoom?: number,
  use_camera?: boolean,
}

export function LZ_OrthoCamera({
  //smooth = 6,
  //default_zoom = 0,
  use_camera = false,
}: LZ_OrthoCameraProps) {

  const { camera } = useThree()

  /*
  const [controls, set] = useControls(() => ({
    Player: folder({
      Camera: folder({
        default_zoom: { value: default_zoom },
      }),
    }),
  }))

  useEffect(() => {
    set({ default_zoom });
  }, [default_zoom, set]);
  */

  // WHEEL ZOOM - disabled until later

  const target_zoom = useRef(40) // target for smooth scroll
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // UPDATE ZOOM TARGET
      target_zoom.current += e.deltaY * -0.01 // invert scroll direction if needed
      target_zoom.current = Math.min(Math.max(target_zoom.current, 10), 100)
    }

    document.addEventListener("wheel", onWheel)
    return () => { document.removeEventListener("wheel", onWheel) }
  }, [])
  useFrame(() => {
    // UPDATE ZOOM  
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom += (target_zoom.current - camera.zoom) * 0.1
      camera.updateProjectionMatrix()
    }
  })

  return (
    <>
      <OrthographicCamera
        makeDefault={use_camera}
        zoom={40}
        near={-100}
        far={100}
        top={400}
        bottom={-400}
      />

      {use_camera && <>
        <primitive object={camera} />
      </>}
    </>
  )
}


export function LZ_CameraSwitcher(default_props: LZ_CamerOrientationControllerProps) {

  const ortho = default_props.ortho ?? false;
  const can_switch = default_props.can_switch_camera ?? true;

  const [controls, set] = useControls(() => ({
    Player: folder({
      Camera: folder({
        ortho: { value: ortho, render: () => { return can_switch } }
      }),
    }),
  }))

  useEffect(() => {
    set({ ortho, });
  }, [ortho, set]);

  // ORTHO SWAP
  useEffect(() => {
    if (!can_switch) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF") { set({ ortho: !controls.ortho }) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [controls.ortho, set, can_switch])


  return (
    <>
      {!controls.ortho && <LZ_PerspectiveCameraSmooth {...default_props} />}
      <LZ_OrthoCamera use_camera={controls.ortho} />
    </>
  )
}



/*


  
  */