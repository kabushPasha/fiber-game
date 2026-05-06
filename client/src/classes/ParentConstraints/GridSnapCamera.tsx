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

        const cam = camera as THREE.OrthographicCamera;

        parent.getWorldPosition(parentWorld)
        parent.getWorldQuaternion(parentOrient)

        const snap = (value: number, size: number) => Math.round(value / size) * size;

        const worldUnitsPerPixel = (cam.top - cam.bottom) / cam.zoom / gl.domElement.height;
        const worldUnitsPerPixel2 = (cam.right - cam.left) / cam.zoom / gl.domElement.width;

        // camera basis vectors
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(parentOrient);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(parentOrient);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(parentOrient);

        // project into camera plane coordinates
        const x = parentWorld.dot(right);
        const y = parentWorld.dot(up);

        // snap in pixel-aligned world units
        const snappedX = snap(x, worldUnitsPerPixel2);
        const snappedY = snap(y, worldUnitsPerPixel);

        // rebuild position      
        g.position
            .copy(right.multiplyScalar(snappedX))
            .add(up.multiplyScalar(snappedY))
            .add(forward.multiplyScalar(parentWorld.dot(forward)));

        g.rotation.setFromQuaternion(parentOrient)
        //g.position.copy(parentWorld);

        // Update Canvas Offset
        /*
        const client_width = gl.domElement.clientWidth;
        const pixel_scale = client_width / gl.domElement.width;
        const screen_offsetX = -pixel_scale * (x - snappedX) / worldUnitsPerPixel2;
        const screen_offsetY = pixel_scale * (y - snappedY) / worldUnitsPerPixel;
        let scale = gl.domElement.height / (gl.domElement.height - 1);
        gl.domElement.style.transform = `scale(${scale}) translate(${screen_offsetX}px, ${screen_offsetY}px)`;
        */

        // update Uniform
        cam.userData["pixel_grid_offset"] = [snappedX / worldUnitsPerPixel2, -snappedY / worldUnitsPerPixel];


    }, -5)

    return <group ref={groupRef}>{children}</group>
}





