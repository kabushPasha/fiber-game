import { PointerLockControls, useKeyboardControls } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { useUI } from "../../components/UIScreenContext"
import { CrosshairDot } from "../../components/CrosshairDot"
import { GameObject3D } from "../GameObjectContext"


const SPEED = 25;

interface PlayerProps {
  children?: ReactNode
}

export function Player({ children }: PlayerProps) {
  const playerRef = useRef<THREE.Group>(null!);

  const { mount } = useUI()
  const controls = useRef<any>(null)
  const [, get] = useKeyboardControls()
  const { camera } = useThree()

  useFrame((_, delta) => {
    if (!controls.current?.isLocked) return

    const { forward, backward, left, right } = get()

    const z = (Number(forward) - Number(backward)) * SPEED * delta
    const x = (Number(right) - Number(left)) * SPEED * delta


    // get camera Directions
    const cam_forward = new THREE.Vector3()
    camera.getWorldDirection(cam_forward)
    cam_forward.y = 0
    cam_forward.normalize()
    const cam_right = new THREE.Vector3().crossVectors(cam_forward, new THREE.Vector3(0, 1, 0)).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(cam_forward, z)
    move.addScaledVector(cam_right, x)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(SPEED * delta)
      playerRef.current.position.add(move)
    }

  }, -10)

  useEffect(() => {
    const unmount = mount(() =>
      <CrosshairDot size={6} color="white" opacity={0.5} />
    )
    return unmount
  }, [])

  return (
    <GameObject3D ref={playerRef} name="Player">
        <PointerLockControls
          ref={controls}
          camera={camera}
          pointerSpeed={0.1}
        />
        {children}
    </GameObject3D>
  )
}