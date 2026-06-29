import { BallCollider, Physics, RigidBody } from "@react-three/rapier";
import { Pixelated } from "../../../components/Pixelated";
import { Walker3D_Player } from "./classes/Player3DWalker";
import { Sphere, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three/webgpu";
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext";
import { WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext";
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
                    {<PP_RimLight amp={0.5} />}
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
                    {<PP_RimLight amp={0.5} />}

                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.25} />
        {1 && <directionalLight position={[5, 10, 5]} intensity={1} />}

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            {1 && <JapLevel />}
            {0 && <NestLevel />}
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}



const positions = [
    [5.96, 18.659, -8.101],
    [13.827, 53.274, -13.111],
    [3.864, 20.672, -2.179],
    [-2.831, 66.451, -36.596],
    [32.845, 27.013, -30.464],
    [-26.863, 49.063, -15.568],
    [3.009, 54.552, -26.511],
    [21.372, 29.969, -20.906],
    [2.229, 61.715, 12.018],
    [20.726, 57.028, -18.133],
    [39.003, 29.523, -30.14],
    [-22.864, 31.701, -36.828],
    [30.258, 32.858, -30.13],
    [-35.764, 47.695, -13.233],
    [23.852, 38.609, 21.504],
    [-25.512, 41.81, 5.371],
    [30.542, 66.618, -21.338],
    [28.872, 61.421, -25.338],
    [-1.54, 41.33, -48.106],
    [-28.813, 34.884, -32.795],
    [-7.426, 71.509, -19.478],
    [32.711, 60.354, -19.514],
    [1.927, 56.487, -0.604],
    [1.876, 17.704, -10.55],
    [2.729, 55.195, -34.243],
    [35.857, 41.61, -15.266],
    [25.967, 28.145, -24.198],
    [17.339, 49.854, -20.465],
    [4.951, 61.502, -38.598],
    [2.94, 14.065, -6.528],
    [-29.114, 43.321, -14.529],
    [-31.016, 43.948, -19.762],
    [26.505, 34.685, 14.404],
    [-1.358, 57.55, -8.321],
    [-21.01, 36.425, -32.946],
    [42.724, 41.66, -15.688],
    [6.022, 14.425, -6.006],
    [29.431, 45.029, -15.458],
    [-18.213, 46.441, -12.491],
    [26.965, 36.165, -24.459],
    [1.47, 75.732, -0.048],
    [37.004, 28.584, -32.551],
    [39.83, 41.92, -23.039],
    [-0.518, 43.664, -44.594],
    [2.152, 66.588, 18.506],
    [-15.789, 45.259, -4.262],
    [33.775, 28.025, -25.436],
    [23.799, 39.839, -14.258],
    [36.698, 32.664, -25.275],
    [0.006, 7.763, -0.58]
]


export function NestLevel() {
    //reset State
    const reset = useGameStore((s) => s.reset);
    useEffect(() => { reset(); }, [reset]);

    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />

                    {<PP_RimLight amp={0.7} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}

                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.75} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <NestLevelGeo />


            <Collectible position={[0, 0, -5]} />

            {positions.map((pos, i) => (
                <Collectible key={i} position={pos as [number, number, number]} />
            ))}

        </Physics>

        <Collected_UIHud />

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}


import { create } from "zustand";
import { useUI } from "../../../components/UIScreenContext";
import { useLoader } from "@react-three/fiber";


type GameState = {
    collected: number;
    addCollectible: () => void;
    reset: () => void;
};

export const useGameStore = create<GameState>((set) => ({
    collected: 0,

    addCollectible: () =>
        set((state) => ({
            collected: state.collected + 1,
        })),

    reset: () => set({ collected: 0 }),
}));


type CollectibleProps = {
    position: [number, number, number];
};

export function Collectible({ position }: CollectibleProps) {
    const addCollectible = useGameStore((s) => s.addCollectible);
    const [collected, setCollected] = useState<boolean>(false);
    if (collected) return null;

    return (
        <RigidBody type="fixed" position={position} colliders={false}>
            <BallCollider
                args={[2]}
                sensor
                onIntersectionEnter={() => {
                    addCollectible();
                    setCollected(true);
                    const audio = new Audio("sfx/Pap.mp3");
                    audio.volume = 1.0;
                    audio.play();
                }}
            />
            <Sphere />
        </RigidBody>
    );
}



export function Collected_UIHud() {
    const ui = useUI();

    useEffect(() => {
        const unmount = ui.mount(() => <CollectedUIcomponent />);
        console.log("Mount UI");
        return unmount;
    }, [ui]);

    return null;
}

function CollectedUIcomponent() {
    const collected = useGameStore((s) => s.collected);

    return (
        <div
            style={{
                position: "absolute",
                bottom: 25,
                left: 25,
                zIndex: 9999,
                color: "#ff3e3e",
                width: "50%",
            }}
        >
            {collected}
        </div>
    );
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
        {0 && <directionalLight position={[5, 10, 5]} intensity={0} />}
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


                    {<PP_RimLight amp={0.7} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}



                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.75} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <InnerNestGeo />
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
        {0 && <directionalLight position={[5, 10, 5]} intensity={0} />}
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


                    {<PP_RimLight amp={0.7} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}



                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.75} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <CubeLevelGeo />
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


                    {<PP_RimLight amp={0.7} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}



                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.75} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <CubeCorridorGeo />
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


                    {<PP_RimLight amp={0.7} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}


                    {1 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.75} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <CityGeo />
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


export function LightmapLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {0 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />


                    {0 && <PP_RimLight amp={0.7} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}


                    {0 && <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={.00} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <LightmapGeo />
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

function LightmapGeo() {
    //const scene = useGLTF("models/Level/jap/city.glb");
    const scene = useGLTF("models/Level/jap/lm.glb");
    const render = useGLTF("models/Level/jap/stairs_inst.glb.instanced.glb");

    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
        console.log(scene);
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

    const lightMap = useLoader(THREE.TextureLoader, "models/Level/jap/lm.png");

    useEffect(() => {
        lightMap.flipY = false;
        lightMap.colorSpace = THREE.LinearSRGBColorSpace;
        lightMap.wrapS = THREE.ClampToEdgeWrapping;
        lightMap.wrapT = THREE.ClampToEdgeWrapping;
        lightMap.channel = 2;
        lightMap.needsUpdate = true;

        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {

                const materials = Array.isArray(obj.material)
                    ? obj.material
                    : [obj.material];

                materials.forEach((mat) => {
                    mat.lightMap = lightMap;
                    mat.lightMapIntensity = 2.0;
                    mat.needsUpdate = true;
                });
            }
        });
    }, [scene, lightMap]);




    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {0 && <primitive object={render.scene} />}
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




export function RootsLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {0 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />

                    {1 && <PP_RimLight amp={0.5} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}

                    {1 && <PP_FogPass heightFalloff={0.01} start_distance={55} density={0.01} color="#2a4b6c" />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={1.00} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <RootsGeo />
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

function RootsGeo() {
    //const scene = useGLTF("models/Level/jap/city.glb");
    //const scene = useGLTF("models/Level/jap/Roots.glb");
    const scene = useGLTF("models/Level/jap/Roots-Optimized.3.glb");

    //const scene_cd = useGLTF("models/Level/jap/stairs_inst_cd.glb.instanced.glb");
    //const scene_cd = useGLTF("models/Level/jap/stairs_inst_cd.glb.instanced.glb.COLOR.glb");
    //const scene_cd = useGLTF("models/Level/jap/RootScatter.glb.instanced.glb.COLOR.glb");
    const scene_cd = useGLTF("models/Level/INSTANCE/SC_G.glb.I.glb");
    //const scene_cd = useGLTF("models/Level/jap/stairs_inst_cd.glb");
    //console.log("CD_SCEN", scene_cd);


    useEffect(() => {
        scene_cd.scene.traverse((obj) => {
            if (obj instanceof THREE.InstancedMesh) {

                const colorAttribute = obj.geometry.getAttribute("_COLOR");
                console.log("instanced_obj", obj, colorAttribute);
                if (colorAttribute) {
                    obj.instanceColor = colorAttribute;
                    obj.instanceColor!.needsUpdate = true;
                }
            }
        });
    }, [scene_cd]);


    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
        console.log(scene);
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                //obj.layers.enable(2);
                //obj.layers.set(2);
            }
        });
    }, [scene]);


    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
        {1 && <primitive object={scene_cd.scene} />}
    </>
}


export function MiningCavesLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <PP_Ao />}
                    {1 && <PP_Sharpen strength={0.05} />}
                    <PP_ColorGrading />

                    {1 && <PP_RimLight amp={0.5} />}
                    {1 && <PP_Vignette />}
                    {1 && <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />}

                    {1 && <PP_FogPass heightFalloff={0.01} start_distance={55} density={0.01} color="#2a4b6c" />}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}

        <Pixelated resolution={512} enabled={true} />
        <ambientLight intensity={1.00} />

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <MiningCavesGeo />
        </Physics>

        {1 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
    </>
}

function MiningCavesGeo() {
    const scene = useGLTF("models/Level/jap/Level_Caves.glb");
    //const scene = useGLTF("models/Level/jap/DressingCell.glb");


    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
        console.log(scene);

        for (const mat of Object.values(scene.materials)) {
            mat.side = THREE.DoubleSide;
            mat.needsUpdate = true;
        }
    }, [scene]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                //obj.layers.enable(2);
                //obj.layers.set(2);
            }
        });
    }, [scene]);


    return <>
        <RigidBody type="fixed" colliders="trimesh">
            <primitive object={scene.scene} />
        </RigidBody>
    </>
}