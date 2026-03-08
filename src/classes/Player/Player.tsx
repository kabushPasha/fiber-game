import {  useKeyboardControls } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { useUI } from "../../components/UIScreenContext"
import { CrosshairDot } from "../../components/CrosshairDot"
import { GameObject3D } from "../GameObjectContext"
import { SmoothCamera } from "../ParentConstraints/SmoothChild"
import { useMouseLock } from "./MouseLock"
import { CameraController } from "./CameraController"


const SPEED = 10
const SPRINT_SPEED = 25 // sprint speed

interface PlayerProps {
  children?: ReactNode
}

export function Player({ children }: PlayerProps) {
  const playerRef = useRef<THREE.Group>(null!);
  const { mount } = useUI()
  const [, get] = useKeyboardControls()
  const { } = useThree()

  const { isLocked } = useMouseLock()

  const currentSpeed = useRef(SPEED)

  const orient = new THREE.Quaternion()
  const player_forward = new THREE.Vector3()
  const player_right = new THREE.Vector3()

  useFrame((_, delta) => {
    if (!isLocked) return

    const { forward, backward, left, right, shift } = get()

    // Target Speed
    const targetSpeed = shift ? SPRINT_SPEED : SPEED
    currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, targetSpeed, 10, delta)

    // get camera Directions
    playerRef.current.getWorldQuaternion(orient)
    player_forward.set(0, 0, -1).applyQuaternion(orient)
    player_right.set(1, 0, 0).applyQuaternion(orient)

    // Input Vectors
    const z = (Number(forward) - Number(backward))
    const x = (Number(right) - Number(left))

    // construct move
    const move = new THREE.Vector3()
    move.addScaledVector(player_forward, z)
    move.addScaledVector(player_right, x)

    const vel = playerRef.current.userData.vel

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(currentSpeed.current)
      vel.x = move.x
      vel.z = move.z
    } else {
      vel.x = 0
      vel.z = 0
    }

  }, -10)

  useEffect(() => {
    const unmount = mount(() =>
      <CrosshairDot size={6} color="white" opacity={0.5} />
    )
    return unmount
  }, [])


  useEffect(() => {
    if (!playerRef.current.userData.vel)
      playerRef.current.userData.vel = new THREE.Vector3(0, 0, 0)
  }, [playerRef])

  return (
    <GameObject3D ref={playerRef} name="Player">
      {children}

      <CameraController>
        {1 && <SmoothCamera />}
      </CameraController>

    </GameObject3D>
  )
}