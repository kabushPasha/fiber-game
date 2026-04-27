import { useFrame } from "@react-three/fiber"
import { useRef, type ReactNode } from "react"
import * as THREE from "three"
import { GameObject3D, useGameObject3D } from "../GameObjectContext"
import { useMouseLock } from "./MouseLock"
import { folder, useControls } from "leva"

interface CameraControllerProps {
    children?: ReactNode
    horizontal_snap?: number
    vertical_snap?: number
}
export function CameraController({
    children,
    horizontal_snap = 0,
    vertical_snap = 0,
}: CameraControllerProps) {
    const { objectRef: playerRef } = useGameObject3D() // parent Player
    const neckRef = useRef<THREE.Group>(null!)

    const controls = useControls({
        Player: folder({
            Camera: folder({
                Snapping: folder({
                    horizontal_snap: {
                        value: horizontal_snap,
                        min: 0,
                        max: 64,
                        step: 1,
                    },
                    vertical_snap: {
                        value: vertical_snap,
                        min: 0,
                        max: 64,
                        step: 1,
                    },
                }),
            }),
        }),
    })

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

        let finalYaw = yaw.current
        let finalPitch = pitch.current

        // ✅ Horizontal (yaw)
        if (controls.horizontal_snap > 0) {
            finalYaw = snapAngle(yaw.current, controls.horizontal_snap*4)
        }

        // ✅ Vertical (pitch)
        if (controls.vertical_snap > 0) {
            finalPitch = snapAngle(pitch.current, controls.vertical_snap*8)
        }

        playerRef.current.rotation.y = finalYaw
        neckRef.current.rotation.x = finalPitch

    })

    return (
        <GameObject3D ref={neckRef} name="PlayerNeck" position={[0, 2, 0]}>
            {children}
        </GameObject3D>
    )
}


export function snapAngle(angle: number, directions: number) {
    const step = (Math.PI * 2) / directions
    return Math.round(angle / step) * step
}