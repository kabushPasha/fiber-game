import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { GameObject3D, useGameObject3D } from "../GameObjectContext"
import { useMouseLock } from "./MouseLock"
import { folder, useControls } from "leva"
import { degToRad } from "three/src/math/MathUtils.js"

export interface LZ_CamerOrientationControllerProps {
    children?: ReactNode
    snap?: boolean
    horizontal_snap?: number
    vertical_snap?: number
    snap_time?: number

    default_yaw?: number
    default_pitch?: number
    min_pitch?: number
    max_pitch?: number

    defaultZ?: number
    ortho?: boolean
    can_switch_camera?: boolean
}
export function LZ_CamerOrientationController({
    children,
    snap = true,
    horizontal_snap = 8,
    vertical_snap = 8,
    snap_time = 0.4,
    default_pitch = 0.0,
    default_yaw = 0.0,
    min_pitch = .2,
    max_pitch = .8,    
}: LZ_CamerOrientationControllerProps) {
    const { objectRef: playerRef } = useGameObject3D() // parent Player
    const neckRef = useRef<THREE.Group>(null!)

    const [controls, set] = useControls(() => ({
        Player: folder({
            Camera: folder({
                snap: { value: snap },
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
                    snap_time: {
                        value: snap_time,
                        min: 0,
                        max: 1,
                        step: 0.01,
                    },
                }, {
                    render: (get) => get("Player.Camera.snap"),
                }),
                min_pitch: { value: min_pitch, min: -1.0, max: 1.0, step: 0.1 },
                max_pitch: { value: max_pitch, min: -1.0, max: 1.0, step: 0.1 },
            }),
        }),
    }))

    const { camera } = useThree()
    const ortho = useMemo(() => {
        return camera instanceof THREE.OrthographicCamera;
    }, [camera])


    useEffect(() => {
        set({ horizontal_snap, vertical_snap, snap_time, snap, min_pitch, max_pitch, });
    }, [horizontal_snap, vertical_snap, snap_time, snap, min_pitch, max_pitch, set]);

    const { consumeDelta, isLocked } = useMouseLock()

    const yaw = useRef(degToRad(default_yaw))
    const pitch = useRef(-degToRad(default_pitch))

    useEffect(() => {
        yaw.current = degToRad(default_yaw);
        pitch.current = -degToRad(default_pitch);
        playerRef.current.rotation.y = yaw.current
        neckRef.current.rotation.x = pitch.current
    }, [default_yaw, default_pitch])

    const sensitivity = 0.0005

    useFrame((_, delta) => {
        if (!playerRef.current || !neckRef.current) return
        if (!isLocked) return

        const mouse = consumeDelta()

        yaw.current -= mouse.x * sensitivity
        pitch.current -= mouse.y * sensitivity

        pitch.current = THREE.MathUtils.clamp(
            pitch.current,
            (ortho ? -controls.max_pitch : -1.0) * Math.PI / 2,
            (ortho ? -controls.min_pitch : 1.0) * Math.PI / 2
        )

        let finalYaw = yaw.current
        let finalPitch = pitch.current

        if (controls.snap && ortho) {
            // Snap Angles
            if (controls.horizontal_snap > 0) {
                finalYaw = snapAngle(yaw.current, controls.horizontal_snap * 4)
            }
            if (controls.vertical_snap > 0) {
                finalPitch = snapAngle(pitch.current, controls.vertical_snap * 8)
            }

            // Blend
            if (controls.snap_time == 0) {
                playerRef.current.rotation.y = finalYaw
                neckRef.current.rotation.x = finalPitch
            }
            else {
                // --- pixel-perfect constant speed movement ---
                const speed = controls.snap_time <= 0 ? 1 : delta / controls.snap_time

                playerRef.current.rotation.y = moveTowardsAngle(
                    playerRef.current.rotation.y,
                    finalYaw,
                    speed
                )

                neckRef.current.rotation.x = moveTowardsAngle(
                    neckRef.current.rotation.x,
                    finalPitch,
                    speed
                )
            }
        }
        else {
            playerRef.current.rotation.y = finalYaw
            neckRef.current.rotation.x = finalPitch
        }

    })

    return (
        <GameObject3D ref={neckRef} name="PlayerNeck" position={[0, 2, 0]} rotation={[0, 0, 0]}>
            {children}
        </GameObject3D>
    )
}


export function snapAngle(angle: number, directions: number) {
    const step = (Math.PI * 2) / directions
    return Math.round(angle / step) * step
}

/**
 * Constant-speed angular movement (NO easing tail, pixel-art safe)
 */
function moveTowardsAngle(current: number, target: number, maxDelta: number) {
    let diff = target - current

    // shortest rotation direction
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))

    if (Math.abs(diff) <= maxDelta) return target

    return current + Math.sign(diff) * maxDelta
}