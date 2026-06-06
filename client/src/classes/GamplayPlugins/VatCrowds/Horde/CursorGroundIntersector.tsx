import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useHordeStore } from "./PlayerStore_Horde";


export function CursorGroundHit() {
    const { camera, pointer } = useThree();

    const ndc = useMemo(() => new THREE.Vector3(), []);
    const rayDir = useMemo(() => new THREE.Vector3(), []);
    const hit = useMemo(() => new THREE.Vector3(), []);

    useFrame(() => {
        const store = useHordeStore.getState();

        ndc.set(pointer.x, pointer.y, 0.5);
        ndc.unproject(camera);

        const cam_world_pos = new THREE.Vector3()
        camera.getWorldPosition(cam_world_pos);

        rayDir
            .copy(ndc)
            .sub(cam_world_pos)
            .normalize();

        // y = 0 planewD
        const t = -cam_world_pos.y / rayDir.y;

        hit.copy(cam_world_pos).addScaledVector(rayDir, t);
        store.cursorHit.copy(hit);
        store.cursorHitUniform.value.copy(store.cursorHit);
    }, -50);

    return null;
}

export function CursorGroundMarker() {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(() => {
        const pos = useHordeStore.getState().cursorHit;
        if (ref.current) { ref.current.position.copy(pos); }
    });
    return (
        <mesh ref={ref}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshBasicMaterial color="red" />
        </mesh>
    );
}

