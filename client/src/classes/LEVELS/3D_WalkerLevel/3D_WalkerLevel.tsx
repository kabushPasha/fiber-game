import { Physics, RigidBody } from "@react-three/rapier";
import { Pixelated } from "../../../components/Pixelated";
import { Walker3D_Player } from "./classes/Player3DWalker";
import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three/webgpu";





export function Walker3DLevel() {


    return <>
        <Pixelated resolution={512} enabled={true} />

        {0 &&<>
            <ambientLight intensity={1} />
            <directionalLight position={[5, 10, 5]} intensity={2} />
        </>}

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />

            <Level />
        </Physics>
    </>
}


export function Ground() {
    return (
        <RigidBody type="fixed" collisionGroups={2}>
            <mesh receiveShadow position={[0, -0.5, 0]}>
                <boxGeometry args={[50, 1, 50]} />
                <meshStandardMaterial color="lightgreen" />
            </mesh>
        </RigidBody>
    );
}



export function Level() {
    const { scene } = useGLTF("models/Level/test2.glb");

    useEffect(() => {
        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
        });

        scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.material = material;
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        return () => {
            material.dispose();
        };
    }, [scene]);

    return (
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene} />
        </RigidBody>
    );
}