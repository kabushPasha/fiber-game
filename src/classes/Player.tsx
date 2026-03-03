import { PointerLockControls, useKeyboardControls } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef, ReactNode } from "react"
import * as THREE from "three"
import { useUI } from "../components/UIScreenContext"
import { CrosshairDot } from "../components/CrosshairDot"


const SPEED = 15

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

    controls.current.moveForward(z)
    controls.current.moveRight(x)
    
    playerRef.current.position.copy(camera.position);
    
  })

  useEffect(() => {
    const unmount = mount(() =>
      <CrosshairDot size={6} color="white" opacity={0.5} />
    )
    
    return unmount
  }, [])

  return (
    <group name="Player" ref={playerRef}>
      <PointerLockControls
        ref={controls}
        camera={camera}
        pointerSpeed={0.1}
      />
      {children}
    </group>
  )
}