import { PointerLockControls, useKeyboardControls } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef } from "react"
import * as THREE from "three"

const SPEED = 5

export function Player() {
  const controls = useRef<any>(null)
  const [, get] = useKeyboardControls()
  const { camera } = useThree()

  useFrame((_, delta) => {
    if (!controls.current?.isLocked) return

    const { forward, backward, left, right } = get()

    const z = (Number(forward) - Number(backward)) * SPEED * delta
    const x = (Number(right) - Number(left)) * SPEED * delta

    controls.current.moveForward(z)
    controls.current.moveRight(x)
  })

  return (
    <PointerLockControls
      ref={controls}
      camera={camera}
      pointerSpeed={0.1}
    />
  )
}
