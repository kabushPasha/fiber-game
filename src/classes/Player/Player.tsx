import { PointerLockControls, useKeyboardControls } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { useUI } from "../../components/UIScreenContext"
import { CrosshairDot } from "../../components/CrosshairDot"
import { GameObject3D } from "../GameObjectContext"
import { SmoothCamera } from "../Terrain/TerrainSampler"


const SPEED = 10
const SPRINT_SPEED = 25 // sprint speed

interface PlayerProps {
  children?: ReactNode
}

export function Player({ children }: PlayerProps) {
  const playerRef = useRef<THREE.Group>(null!);
  const neckRef = useRef<THREE.Group>(null!)
  const { mount } = useUI()
  const controls = useRef<any>(null)
  const [, get] = useKeyboardControls()
  const { camera, gl } = useThree()

  const currentSpeed = useRef(SPEED)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const sensitivity = 0.0005

  useEffect(() => {
    const canvas = gl.domElement

    const onClick = () => {
      canvas.requestPointerLock()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return

      yaw.current -= e.movementX * sensitivity
      pitch.current -= e.movementY * sensitivity

      // clamp pitch
      pitch.current = THREE.MathUtils.clamp(
        pitch.current,
        -Math.PI / 2,
        Math.PI / 2
      )
    }

    canvas.addEventListener("click", onClick)
    document.addEventListener("mousemove", onMouseMove)

    return () => {
      canvas.removeEventListener("click", onClick)
      document.removeEventListener("mousemove", onMouseMove)
    }
  }, [])




  useFrame((_, delta) => {
    if (!playerRef.current) return
    if (!neckRef.current) return
    playerRef.current.rotation.y = yaw.current
    neckRef.current.rotation.x = pitch.current



    //if (!controls.current?.isLocked) return
    const canvas = gl.domElement
    if (document.pointerLockElement !== canvas) return

    const { forward, backward, left, right, shift } = get()

    // Target Speed
    const targetSpeed = shift ? SPRINT_SPEED : SPEED
    currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, targetSpeed, 10, delta)

    // Input Vectors
    const z = (Number(forward) - Number(backward)) * SPEED * delta
    const x = (Number(right) - Number(left)) * SPEED * delta


    // get camera Directions
    const cam_forward = new THREE.Vector3()
    playerRef.current.getWorldDirection(cam_forward)
    cam_forward.y = 0
    cam_forward.normalize()
    const cam_right = new THREE.Vector3().crossVectors(cam_forward, new THREE.Vector3(0, 1, 0)).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(cam_forward, -z)
    move.addScaledVector(cam_right, -x)

    const vel = playerRef.current.userData.vel
    console.log("player",vel)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(currentSpeed.current)

      vel.x = move.x
      vel.z = move.z

      //playerRef.current.position.add(move)
      playerRef.current.userData.is_moving = true;
    } else {
      vel.x = 0
      vel.z = 0
      playerRef.current.userData.is_moving = false;
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
      {0 && <PointerLockControls ref={controls} camera={camera} pointerSpeed={0.1} />}
      {children}

        <GameObject3D ref={neckRef} name="PlayerNeck" position={[0,2,0]}>
          {1 && <SmoothCamera />}
        </GameObject3D>


    </GameObject3D>
  )
}