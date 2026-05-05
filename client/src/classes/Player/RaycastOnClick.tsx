import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export function RaycastOnClick() {
    const { camera, scene, gl } = useThree(); // gl is the canvas

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            const bounds = gl.domElement.getBoundingClientRect();

            if (document.pointerLockElement === gl.domElement) {
                // Pointer lock: use center of screen
                mouse.set(0, 0); // NDC center
            } else {
                // Normal mouse
                mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
                mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            }

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            console.log(intersects.length > 0 ? intersects[0] : "No intersects");
        };

        gl.domElement.addEventListener("click", handleClick);
        return () => gl.domElement.removeEventListener("click", handleClick);
    }, [camera, scene, gl]);

    return null;
}