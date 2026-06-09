import { Physics, RigidBody } from "@react-three/rapier";
import { Pixelated } from "../../../components/Pixelated";
import { Walker3D_Player } from "./classes/Player3DWalker";
import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three/webgpu";
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext";
import { WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext";
import { PP_Sharpen } from "../../PostProcessing/Effects/PP_Sharpen";
import {  PP_Vignette } from "../../PostProcessing/Effects/PP_Dof";
import { PP_PalDither } from "../../PostProcessing/Effects/PP_PalDither";
import { SnowSpritesUI } from "../../Terrain/SnowSprites";





export function Walker3DLevel() {


    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    <PP_Sharpen strength={0.05} />

                    <PP_Vignette />
                    <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />

                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}


        <Pixelated resolution={512} enabled={true} />

        {1 && <>
            <ambientLight intensity={1} />
            <directionalLight position={[5, 10, 5]} intensity={0} />
        </>}

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />

            <Level />
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03}/>}
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
    //const { scene } = useGLTF("models/Level/test2.glb");
    const scene = useGLTF("models/Level/test2.glb");
    const render_scene = useGLTF("models/Level/test2_rend.glb");

    console.log("Loaded Scene", scene);



    // Make textures Use linear mapping
    useEffect(() => {

        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                if (obj.material.map instanceof THREE.Texture) {
                    obj.material.map.magFilter = THREE.NearestFilter;
                    obj.material.map.minFilter = THREE.NearestFilter;
                    obj.material.map.generateMipmaps = false;
                    obj.material.map.needsUpdate = true;
                }

                obj.layers.enable(2);
                obj.layers.enable(2);
            }
        });

    }, [scene]);



    useEffect(() => {
        const music = new Audio("sfx/Guitar_main_STRETCH.mp3");

        music.loop = true;
        music.volume = 0.5;

        const startMusic = async () => {
            try {
                await music.play();

                // Remove listeners once playback succeeds
                window.removeEventListener("pointerdown", startMusic);
                window.removeEventListener("keydown", startMusic);
            } catch (err) {
                console.error(err);
            }
        };

        window.addEventListener("pointerdown", startMusic);
        window.addEventListener("keydown", startMusic);

        return () => {
            window.removeEventListener("pointerdown", startMusic);
            window.removeEventListener("keydown", startMusic);

            music.pause();
            music.currentTime = 0;
        };
    }, []);





    return (
        <>
            <RigidBody type="fixed" colliders="trimesh">
                <primitive object={scene.scene} />
            </RigidBody>


            <primitive object={render_scene.scene} />


        </>
    );
}