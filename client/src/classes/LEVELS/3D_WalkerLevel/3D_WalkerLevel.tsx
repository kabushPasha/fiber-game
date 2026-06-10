import { Physics, RigidBody } from "@react-three/rapier";
import { Pixelated } from "../../../components/Pixelated";
import { Walker3D_Player } from "./classes/Player3DWalker";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext";
import { WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext";
import { PP_Sharpen } from "../../PostProcessing/Effects/PP_Sharpen";
import { PP_Vignette } from "../../PostProcessing/Effects/PP_Dof";
import { PP_PalDither } from "../../PostProcessing/Effects/PP_PalDither";
import { SnowSpritesUI } from "../../Terrain/SnowSprites";
import { PP_FogPass } from "../../PostProcessing/Effects/PP_FogPass";
import { PP_ColorGrading } from "../../PostProcessing/Effects/PP_ColorGrading";
import { PP_Ao, PP_SSGI } from "../../PostProcessing/Effects/PP_Ao";
import { InstanceMesh } from "../../Terrain/ECS/ECS_Base";
import { bufferAttribute, float, instanceIndex, int, normalLocal, positionLocal, storage } from "three/tsl";




export function Walker3DLevel() {
    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >

                    {1 && <PP_SSGI />}
                    {1 && <PP_Ao />}
                    <PP_Sharpen strength={0.05} />


                    <PP_ColorGrading />

                    <PP_Vignette />


                    <PP_PalDither dither={0.01} palette="waldgeist-1x.png" />
                    <PP_FogPass heightFalloff={0} start_distance={5} density={0.01} />


                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>}


        <Pixelated resolution={512} enabled={true} />

        {1 && <>
            <ambientLight intensity={1.0} />
            <directionalLight position={[5, 10, 5]} intensity={0} />
        </>}

        <Physics gravity={[0, -9.81, 0]}>
            <Walker3D_Player />
            <Level />
        </Physics>

        {0 && <SnowSpritesUI active={true} showControls={true} count={5000} areaSize={30} height={100} fallSpeed={0.3} size={0.03} />}
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


export function Lattice() {
    const lattice = useGLTF("models/Level/lattice2.glb");
    const window = useGLTF("models/Level/window.glb");
    console.log("Loaded LATTICE", lattice.meshes.file1.geometry);

    const [mat, count] = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        const pos_att = lattice.meshes.file1.geometry.attributes.position as THREE.BufferAttribute
        const posBuffer = storage(pos_att, 'vec4', pos_att.count);

        const N_att = lattice.meshes.file1.geometry.attributes.normal as THREE.BufferAttribute
        const NBuffer = storage(N_att, 'vec3', N_att.count);

        const srcIndex = lattice.meshes.file1.geometry.index!;
        const count = srcIndex.count / 6;
        const indexStorage = new THREE.StorageBufferAttribute(srcIndex.array.slice(), 1);
        const index_buffer = storage(indexStorage, 'uint');

        const index = instanceIndex.mul(6);
        const i0 = index_buffer.element(index);
        const i1 = index_buffer.element(index.add(2));
        const i2 = index_buffer.element(index.add(3));
        const i3 = index_buffer.element(index.add(5));

        const p0 = posBuffer.element(i0)
        const p1 = posBuffer.element(i1)
        const p2 = posBuffer.element(i3)
        const p3 = posBuffer.element(i2)

        const P = positionLocal.y.mix(
            positionLocal.x.mix(p1, p0),
            positionLocal.x.mix(p3, p2))

        const N = positionLocal.y.mix(
            positionLocal.x.mix(NBuffer.element(i1), NBuffer.element(i0)),
            positionLocal.x.mix(NBuffer.element(i2), NBuffer.element(i3)))


        mat.positionNode = P.add(N.mul(positionLocal.z).mul(1));




        // Normal Transformation
        const Tu = p1.sub(p0).mix(p3.sub(p2), positionLocal.y);
        const Tv = p2.sub(p0).mix(p3.sub(p1), positionLocal.x);
        const Tw = Tu.cross(Tv).normalize();
        const srcN = normalLocal;
        const worldN = Tu.mul(srcN.x).add(Tv.mul(srcN.y)).add(Tw.mul(srcN.z)).normalize();
        mat.normalNode = worldN;

        mat.colorNode = float(0.25);



        return [mat, count];
    }, [lattice]);


    return <>
        {0 && <primitive object={lattice.scene} />}
        <instancedMesh args={[window.meshes.file1.geometry, mat, count]} frustumCulled={false}>
            {0 && <sphereGeometry />}

        </instancedMesh>
    </>

}


export function Level() {
    //const { scene } = useGLTF("models/Level/test2.glb");
    const scene = useGLTF("models/Level/test2.glb");
    const render_scene = useGLTF("models/Level/test2_rend.glb");
    const dynamic_obj = useGLTF("models/Level/test2_dynamic.glb");

    //console.log("Loaded Scene", scene);
    //console.log("Loaded Scene dynamic", dynamic_obj);





    // Make textures Use linear mapping
    useEffect(() => {
        applyNearestTextureFilter(scene.scene);
        applyNearestTextureFilter(render_scene.scene);
        applyNearestTextureFilter(render_scene.scene);
    }, [scene,render_scene,dynamic_obj]);

    // Add To Collider Layer
    useEffect(() => {
        scene.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
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
            <Lattice />
            <RigidBody type="fixed" colliders="trimesh">
                {1 && <primitive object={scene.scene} />}
            </RigidBody>


            <primitive object={render_scene.scene} />
            {/*<primitive object={dynamic_obj.scene} />*/}



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