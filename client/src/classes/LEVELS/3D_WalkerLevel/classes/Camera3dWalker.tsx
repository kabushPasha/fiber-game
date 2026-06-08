import * as THREE from "three/webgpu";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useMouseLock } from "../../../Player/MouseLock";
import { degToRad } from "three/src/math/MathUtils.js";
import { GameObject3D } from "../../../GameObjectContext";




export function Walker3d_Camera() {
    const { camera } = useThree()
    const rootRef = useRef<THREE.Group>(null!)
    const neckRef = useRef<THREE.Group>(null!)
    const { consumeDelta, isLocked } = useMouseLock()

    const sensitivity = 0.0005

    const yaw = useRef(degToRad(0))
    const pitch = useRef(-degToRad(0))

    useEffect(() => {
        (camera as THREE.PerspectiveCamera).fov = 50;
        camera.updateProjectionMatrix()
    }, []);


    useFrame((_, delta) => {
        if (!rootRef.current || !neckRef.current) return
        if (!isLocked) return

        const mouse = consumeDelta()

        yaw.current -= mouse.x * sensitivity
        pitch.current -= mouse.y * sensitivity

        pitch.current = THREE.MathUtils.clamp(
            pitch.current,
            (-1.0) * Math.PI / 2,
            (1.0) * Math.PI / 2
        )

        let finalYaw = yaw.current
        let finalPitch = pitch.current

        rootRef.current.rotation.y = finalYaw
        neckRef.current.rotation.x = finalPitch
    })


    return <group ref={rootRef} name={"PlayerRoot"}>
        <GameObject3D name="PlayerNeck" rotation={[degToRad(-60), 0, 0]} ref={neckRef}>
            <primitive object={camera} position={[0, 0, 0]} />
        </GameObject3D>
    </group>
}
