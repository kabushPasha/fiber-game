import { Physics, RigidBody } from "@react-three/rapier";
import { Pixelated } from "../../../components/Pixelated";
import { Walker3D_Player } from "./classes/Player3DWalker";
import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three/webgpu";
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext";
import { WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext";
import { PP_FogPass } from "../../PostProcessing/Effects/PP_FogPass";
import { PP_Sharpen } from "../../PostProcessing/Effects/PP_Sharpen";
import { PP_DoF, PP_Scanline, PP_Vignette } from "../../PostProcessing/Effects/PP_Dof";
import { PP_ColorGrading } from "../../PostProcessing/Effects/PP_ColorGrading";
import { PP_LUT } from "../../PostProcessing/Effects/PP_3DLUTPass";
import { PP_PalDither } from "../../PostProcessing/Effects/PP_PalDither";





export function Walker3DLevel() {


    return <>
        <CameraUniformsProvider>
            <WebGPUPostProcessingProvider >

                <PP_FogPass density={0.5 * 0.01} heightFalloff={0.01} />
                <PP_Sharpen />
                <PP_DoF />
                <PP_ColorGrading />
                <PP_LUT />
                <PP_Vignette />
                <PP_PalDither />
                <PP_Scanline />

            </WebGPUPostProcessingProvider>
        </CameraUniformsProvider>


        <Pixelated resolution={512} enabled={true} />

        {1 && <>
            <ambientLight intensity={1} />
            <directionalLight position={[5, 10, 5]} intensity={0} />
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
    const { scene: scene2 } = useGLTF("models/Level/test3.glb");

    console.log("Loaded Scene", scene2);
    /*
    useEffect(() => {
        console.log("scene",scene);

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
    */

    return (
        <>
            <RigidBody type="fixed" colliders="trimesh">
                <primitive object={scene} />
            </RigidBody>

            {0 && <primitive object={scene2} />}

        </>
    );
}