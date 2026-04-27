import * as THREE from "three"
import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGameObject3D } from "../GameObjectContext"


type GridSnapCameraProps = React.PropsWithChildren<{}>

export function GridSnapCamera({ children }: GridSnapCameraProps) {
    const { objectRef } = useGameObject3D()
    const { scene, camera, gl } = useThree()

    const groupRef = useRef<THREE.Group>(null!)
    const parentWorld = new THREE.Vector3()
    const parentOrient = new THREE.Quaternion()

    // Detach group from hierarchy but maintain world position
    useEffect(() => {
        const g = groupRef.current
        if (!g) return

        g.updateWorldMatrix(true, false)
        g.getWorldPosition(parentWorld)

        scene.add(g)
        g.position.copy(parentWorld)

        return () => {
            scene.remove(g)
        }
    }, [scene])

    // Each frame, copy parent's world position only
    useFrame(() => {
        const parent = objectRef.current
        const g = groupRef.current
        if (!parent || !g) return

        parent.getWorldPosition(parentWorld)
        parent.getWorldQuaternion(parentOrient)

        //const snap_size = 0.3;
        //parentWorld.setX( parentWorld.x - parentWorld.x%snap_size )
        //parentWorld.setZ( parentWorld.z - parentWorld.z%snap_size )
        //parentWorld.setY( parentWorld.y - parentWorld.y%snap_size )

        //g.position.copy(parentWorld)
        //g.rotation.setFromQuaternion(parentOrient)

        const snap = (value: number, size: number) => Math.round(value / size) * size;

        const cam = camera as THREE.OrthographicCamera;
        const worldUnitsPerPixel = (cam.top - cam.bottom) / cam.zoom / gl.domElement.height;
        console.log(gl.domElement.height, cam.top, cam.bottom);

        // camera basis vectors
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(parentOrient);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(parentOrient);


        // project into camera plane coordinates
        const x = parentWorld.dot(right);
        const y = parentWorld.dot(up);

        // snap in pixel-aligned world units
        const snappedX = snap(x, worldUnitsPerPixel);
        const snappedY = snap(y, worldUnitsPerPixel);

        // rebuild position
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(parentOrient);

        g.position
            .copy(right.multiplyScalar(snappedX))
            .add(up.multiplyScalar(snappedY))
            .add(forward.multiplyScalar(parentWorld.dot(forward)));

        g.rotation.setFromQuaternion(parentOrient)
    }, -5)

    return <group ref={groupRef}>{children}</group>
}





