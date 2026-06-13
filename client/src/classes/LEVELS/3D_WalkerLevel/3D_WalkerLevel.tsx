import { Physics, RigidBody } from "@react-three/rapier";
import { Pixelated } from "../../../components/Pixelated";
import { Walker3D_Player } from "./classes/Player3DWalker";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext";
import {  WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext";
import { PP_Sharpen } from "../../PostProcessing/Effects/PP_Sharpen";
import { PP_Vignette } from "../../PostProcessing/Effects/PP_Dof";
import { PP_PalDither } from "../../PostProcessing/Effects/PP_PalDither";
import { SnowSpritesUI } from "../../Terrain/SnowSprites";
import { PP_FogPass } from "../../PostProcessing/Effects/PP_FogPass";
import { PP_ColorGrading } from "../../PostProcessing/Effects/PP_ColorGrading";
import { PP_Ao } from "../../PostProcessing/Effects/PP_Ao";
import { AutoLattice, Lattice } from "./classes/LatticeGrid";
import { PP_RimLight } from "../../PostProcessing/Effects/PP_RimLight";



export function BrickHallsLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                    {1 && <PP_Vignette />}                    
                    {<PP_RimLight amp={0.5}/>}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />} 
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={1.0} />     

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            {1 && <Level />}
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

export function JapanLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                                                      
                    
                    {1 && <PP_PalDither dither={0.01} palette="witchy-1x.png" />}                     
                    {1 && <PP_Vignette />}    
                    {<PP_RimLight amp={0.5}/>}
                      
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01}/>}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={.25}/>     
        { 1 && <directionalLight position={[5, 10, 5]} intensity={1} />}

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            {1 && <JapLevel/>}
            {0 && <NestLevel/>}
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

export function NestLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                                                      
                    
                    {<PP_RimLight amp={0.7}/>}                    
                    {1 && <PP_Vignette />}    
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}                     
                    
                    
                      
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01}/>}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={.75}/>     

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />            
            <NestLevelGeo/>
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}




export function Level() {
    //const { scene } = useGLTF("models/Level/test2.glb");
    const scene = useGLTF("models/Level/test2.glb");
    const render_scene = useGLTF("models/Level/test2_rend.glb");
    const dynamic_obj = useGLTF("models/Level/test2_dynamic.glb");

    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
        applyNearestTextureFilter(render_scene.scene);
        applyNearestTextureFilter(render_scene.scene);
    }, [scene, render_scene, dynamic_obj]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                //obj.layers.set(2);
            }
        });
    }, [scene]);

    // Musinc
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

    const dynamic_meshes = useMemo(() => {
        const meshes: THREE.Mesh[] = [];

        dynamic_obj.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                meshes.push(obj);
            }
        });

        return meshes;

    }, [dynamic_obj])


    return (
        <>
            {0 && <Lattice />}
            <RigidBody type="fixed" colliders="trimesh">
                {1 && <primitive object={scene.scene} />}
            </RigidBody>

            {1 && <primitive object={render_scene.scene} />}

            {dynamic_meshes.map((mesh, i) => (
                <RigidBody
                    key={i}
                    type="dynamic"
                    colliders="cuboid"
                    position={mesh.position.toArray()}
                    rotation={mesh.rotation.toArray()}
                    scale={mesh.scale.toArray()}
                    gravityScale={0}
                    angularVelocity={[
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                    ]}
                    linearVelocity={[
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                    ]}
                >
                    <mesh
                        geometry={mesh.geometry}
                        material={mesh.material}
                    />
                </RigidBody>
            ))}
        </>
    );
}


export function JapLevel() {
    //const scene = useGLTF("models/Level/jap/collider.glb");
    //const render = useGLTF("models/Level/jap/render.glb");

    const scene = useGLTF("models/Level/jap/jpa_collider.glb");
    const render = useGLTF("models/Level/jap/jpa_ren.glb");


    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                obj.layers.set(2);
            }
        });
    }, [scene]);

    return <>
        <RigidBody type="fixed" colliders="trimesh">
            {1 && <primitive object={scene.scene} />}

            {0 && <AutoLattice gltfPath="models/Level/jap/geo.glb" />}
        </RigidBody>
        {1 && <primitive object={render.scene} />}
        <directionalLight position={[5, 10, 5]} intensity={0} />
    </>
}


export function NestLevelGeo() {
    const scene = useGLTF("models/Level/jap/nest.glb");
    const render = useGLTF("models/Level/jap/rocks.glb");
    //const render = useGLTF("models/Level/jap/nest_render.glb");


    console.log(render);


    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                //obj.layers.set(2);
            }
        });
    }, [scene]);

    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {1 && <primitive object={render.scene} />}
        { 0 && <directionalLight position={[5, 10, 5]} intensity={0} />}
    </>
}



export function InnerNestLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                                                      
                    
                    {<PP_RimLight amp={0.7}/>}                    
                    {1 && <PP_Vignette />}    
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}                     
                    
                    
                      
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01}/>}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={.75}/>     

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />            
            <InnerNestGeo/>
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

export function InnerNestGeo() {
    const scene = useGLTF("models/Level/jap/inner_nest.glb");
    const render = useGLTF("models/Level/jap/innerNest_inst.glb.instanced.glb");
    
    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                //obj.layers.set(2);
            }
        });
    }, [scene]);

    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {1 && <primitive object={render.scene} />}
        { 0 && <directionalLight position={[5, 10, 5]} intensity={0} />}
    </>
}


export function CubeLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                                                      
                    
                    {<PP_RimLight amp={0.7}/>}                    
                    {1 && <PP_Vignette />}    
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}                     
                    
                    
                      
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01}/>}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={.75}/>     

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />            
            <CubeLevelGeo/>
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

export function CubeLevelGeo() {
    const scene = useGLTF("models/Level/jap/cube.glb");
    const render = useGLTF("models/Level/jap/innerNest_inst.glb.instanced.glb");
    
    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                //obj.layers.set(2);
            }
        });
    }, [scene]);

    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {0 && <primitive object={render.scene} />}
    </>
}



export function CubeCorridorLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                                                      
                    
                    {<PP_RimLight amp={0.7}/>}                    
                    {1 && <PP_Vignette />}    
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}                    
                    
                    
                      
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01}/>}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={.75}/>     

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />            
            <CubeCorridorGeo/>
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

function CubeCorridorGeo() {
    const scene = useGLTF("models/Level/jap/cube_corridor.glb");
    const render = useGLTF("models/Level/jap/cube_corridor_walls.glb.instanced.glb");
    
    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                obj.layers.set(2);
            }
        });
    }, [scene]);

    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {1 && <primitive object={render.scene} />}
    </>
}






export function CityLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />
                                                      
                    
                    {<PP_RimLight amp={0.7}/>}                    
                    {1 && <PP_Vignette />}    
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}                    
                    
                                          
                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01}/>}                    
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />        
        <ambientLight intensity={.75}/>     

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />            
            <CityGeo/>
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

function CityGeo() {
    //const scene = useGLTF("models/Level/jap/city.glb");
    const scene = useGLTF("models/Level/jap/stairs.glb");
    const render = useGLTF("models/Level/jap/stairs_inst.glb.instanced.glb");
    
    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.layers.enable(2);
                obj.layers.set(2);
            }
        });
    }, [scene]);

    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {1 && <primitive object={render.scene} />}
    </>
}





export function applyNearestTextureFilter(root: THREE.Object3D) {
    root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;

        const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];

        for (const material of materials) {
            if (!("map" in material)) continue;

            const map = material.map;

            if (map instanceof THREE.Texture) {
                map.magFilter = THREE.NearestFilter;
                map.minFilter = THREE.NearestFilter;
                map.generateMipmaps = false;
                map.needsUpdate = true;
            }
        }
    });
}
