import { useFrame } from "@react-three/fiber"
import { useRef, type ReactNode } from "react"
import * as THREE from "three"
import { GameObject3D, useGameObject3D } from "../GameObjectContext"
import { useMouseLock } from "./MouseLock"

interface CameraControllerProps {
    children?: ReactNode
}

export function CameraController({ children }: CameraControllerProps) {
    const { objectRef: playerRef } = useGameObject3D() // parent Player
    const neckRef = useRef<THREE.Group>(null!)

    const { consumeDelta, isLocked } = useMouseLock()

    const yaw = useRef(0)
    const pitch = useRef(0)

    const sensitivity = 0.0005

    useFrame(() => {
        if (!playerRef.current || !neckRef.current) return
        if (!isLocked) return

        const mouse = consumeDelta()

        yaw.current -= mouse.x * sensitivity
        pitch.current -= mouse.y * sensitivity

        pitch.current = THREE.MathUtils.clamp(
            pitch.current,
            -Math.PI / 2,
            Math.PI / 2
        )

        playerRef.current.rotation.y = yaw.current
        neckRef.current.rotation.x = pitch.current

    })

    return (
        <GameObject3D ref={neckRef} name="PlayerNeck" position={[0, 2, 0]}>
            {children}
        </GameObject3D>
    )
}