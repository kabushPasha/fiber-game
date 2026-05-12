import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { GLTFGeometry, GrassScatter } from "../../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import * as THREE from "three/webgpu"
import { normalLocal, positionLocal, texture, uv, vec2, vec3 } from "three/tsl";
import { useEffect, useMemo, useRef } from "react";
import { ParentWorldPositionConstraint, WorldPositionConstraint } from "../../../ParentConstraints/WorldPositionConstraint";
import { CameraUniformsProvider } from "../../../PostProcessing/cameraUniformsContext";
import { WebGPUPostProcessingProvider } from "../../../PostProcessing/PostProcessingContext";
import { PP_Vignette } from "../../../PostProcessing/Effects/PP_Dof";
import { PP_PalDither } from "../../../PostProcessing/Effects/PP_PalDither";
import { Pixelated } from "../../../../components/Pixelated";
import { TerrainProvider } from "../../../Terrain/TerrainProvider";
import { Player } from "../../../Player/Player";
import { TerrainPlane } from "../../../Terrain/Terrain";
import { GroundClamp, Jump, MoveByVel } from "../../../Player/PlayerPhysics";
import { PinesScatter } from "../../../Terrain/ScatterAPI/Scatter/Presets";
import { SnowSpritesUI } from "../../../Terrain/SnowSprites";
import { DynamicWaterSystemToggle } from "../../../Terrain/ScatterAPI/Scatter/Water";
import { SimpleBackground } from "../../../shaders/Aurora";
import { useFrame, useThree } from "@react-three/fiber";
import { usePlayer } from "../../../Player/PlayerContext";
import { useControls } from "leva";
import { useUI } from "../../../../components/UIScreenContext";



export function Knight() {
    const map = useTexture("models/Char/Knight.png")
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = 'srgb'

    const groupRef = useRef<THREE.Group>(null!)
    const player = usePlayer()

    const customMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();

        const flippedUV = vec2(uv().x, uv().y.oneMinus())
        const materialColor = texture(map, flippedUV);
        material.colorNode = materialColor.clamp(0, 1);

        return material;
    }, [map]);

    const outlineMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();
        material.side = THREE.BackSide;

        material.positionNode = positionLocal.add(normalLocal.mul(0.05));


        material.colorNode = vec3(0.0);

        return material;
    }, [map]);

    const scale = 2.5;

    useFrame(() => {
        const velocity = player.player?.userData.vel;

        if (velocity && (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.z) > 0.001)) {
            const angle = Math.atan2(-velocity.x, -velocity.z);
            groupRef.current.rotation.y = angle;
        }
    })

    return <ParentWorldPositionConstraint>
        <group ref={groupRef}>
            <mesh scale={scale} rotation={[0, Math.PI, 0]} material={customMaterial}>
                <GLTFGeometry url="models/Char/Knight1.glb" />
            </mesh>

            <mesh scale={scale} rotation={[0, Math.PI, 0]} material={outlineMaterial}>
                <GLTFGeometry url="models/Char/Knight1.glb" />
            </mesh>
        </group>
    </ParentWorldPositionConstraint>;

}


const CHARACTERS = [
    "bigknight",    
    "elf",
    //"elk",
    "femknight",
    "fish",
    //"gigaknight",
    "goat",
    "mage",
    "orkking",
    "viking",   
    "immortal", 
] as const;

type CharName = typeof CHARACTERS[number];

export function ImmortalLeva() {
    useEffect(() => {
        CHARACTERS.forEach((c) => {
            useGLTF.preload(`models/Char/newChar/${c}.glb`);
        });
    }, []);

    const [controls, set, get] = useControls(() => ({
        character: {
            value: "bigknight",
            options: CHARACTERS,
        },
    }));

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const k = e.code;
            console.log(e);

            if (k === "KeyN") {
                const i = CHARACTERS.indexOf(get("character") as CharName);
                set({ character: CHARACTERS[(i + 1) % CHARACTERS.length] });
            }

            if (k === "KeyM") {
                const i = CHARACTERS.indexOf(get("character") as CharName);
                set({
                    character:
                        CHARACTERS[(i - 1 + CHARACTERS.length) % CHARACTERS.length],
                });
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);


    const { mount } = useUI()
    useEffect(() => {
        const unmount = mount(() =>
            <>
                <div
                    style={{
                        position: "fixed",     // stays in place even when scrolling
                        bottom: 0,             // align to bottom
                        right: 0,               // align to left
                        padding: "10px",       // optional padding
                        color: "#ffffff9a",        // text color
                        fontSize: "24px",
                        zIndex: 1000           // make sure it's on top
                    }}
                >
                    N/M - swap characters:<br />
                </div>
            </>

        )
        return unmount
    }, [])


    return <Immortal key={controls.character} path={`models/Char/newChar/${controls.character}.glb`} />;
}

export function Immortal({
    path = "models/Char/newChar/bigknight.glb"
}: {
    path?: string;
}) {
    const groupRef = useRef<THREE.Group>(null!)

    const map = useTexture(path + ".png")
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = 'srgb'

    //const { scene, nodes, animations } = useGLTF("models/Char/immortal_rig.glb")
    const { scene, animations } = useGLTF(path)
    const { actions, names } = useAnimations(animations, groupRef);
    //console.log(nodes, animations)

    const currentAction = useRef<string>("idle")

    useEffect(() => {
        animations.forEach((clip) => {
            clip.tracks.forEach((track) => {
                track.setInterpolation(THREE.InterpolateDiscrete)
            })
        })

        actions["idle"]?.reset().fadeIn(0.2).play()

        return () => {
            Object.values(actions).forEach((action) => action?.stop())
        }
    }, [animations, actions])

    console.log("NAMES", names);

    const player = usePlayer()

    const customMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();

        const flippedUV = vec2(uv().x, uv().y.oneMinus())
        const materialColor = texture(map, flippedUV);
        material.colorNode = materialColor.add(.01);

        return material;
    }, [map]);

    const outlineMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();
        material.side = THREE.BackSide;
        material.positionNode = positionLocal.add(normalLocal.mul(0.02));
        material.colorNode = vec3(0.0);
        return material;
    }, [map]);

    const scale = 2;

    useFrame(() => {
        const velocity = player.player?.userData.vel as THREE.Vector3;

        if (velocity && (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.z) > 0.001)) {
            const angle = Math.atan2(-velocity.x, -velocity.z);
            groupRef.current.rotation.y = angle;
        }

        // SPEED
        const speed = velocity.length()
        let nextAction = "idle"
        if (speed < 0.5) {
            nextAction = "idle"
        } else if (speed < 12) {
            nextAction = "walk"
        } else {
            nextAction = "run"
        }

        // SWITCH ANIMATION
        if (currentAction.current !== nextAction) {
            const prev = actions[currentAction.current]
            const next = actions[nextAction]
            prev?.fadeOut(0.15)
            next?.reset().fadeIn(0.15).play()
            currentAction.current = nextAction
        }
    })

    // Apply Materrials and add OUTLINES
    useEffect(() => {
        scene.traverse((obj: any) => {
            if (obj.isSkinnedMesh) {
                obj.material = customMaterial

                const existing = obj.parent?.getObjectByName(
                    obj.name + "_outline"
                )

                if (!existing) {
                    const outline = new THREE.SkinnedMesh(
                        obj.geometry,
                        outlineMaterial
                    )

                    outline.name = obj.name + "_outline"

                    // IMPORTANT
                    outline.skeleton = obj.skeleton

                    outline.bindMatrix.copy(obj.bindMatrix)
                    outline.bindMatrixInverse.copy(
                        obj.bindMatrixInverse
                    )

                    // copy transforms
                    outline.position.copy(obj.position)
                    outline.rotation.copy(obj.rotation)
                    outline.scale.copy(obj.scale)

                    // tiny enlargement
                    outline.scale.multiplyScalar(1.03)

                    // add beside original mesh
                    obj.parent?.add(outline)
                }
            }
        })
    }, [scene, customMaterial, outlineMaterial])


    return <ParentWorldPositionConstraint>
        <group ref={groupRef}>
            <primitive object={scene} scale={scale} rotation={[0, Math.PI, 0]} />
        </group>
    </ParentWorldPositionConstraint>;

}

export function PixelCameraSnap({ children }: React.PropsWithChildren<{}>) {
    const { scene, camera, gl } = useThree()
    const parentRef = useRef<THREE.Group>(null!)

    const groupRef = useRef<THREE.Group>(null!)
    const camOrient = new THREE.Quaternion()
    const parentOrient = new THREE.Quaternion()
    const parentWorld = new THREE.Vector3()

    // Detach from parent on mount
    useEffect(() => {
        const g = groupRef.current
        if (!g) return
        g.updateWorldMatrix(true, false)
        g.getWorldPosition(parentWorld)
        scene.add(g)
        g.position.copy(parentWorld)
        return () => { scene.remove(g) }
    }, [scene])


    useFrame(() => {
        const parent = parentRef.current
        const g = groupRef.current
        if (!parent || !g) return

        parent.getWorldPosition(parentWorld)
        parent.getWorldQuaternion(parentOrient)

        const cam = camera as THREE.OrthographicCamera;
        if (!cam.isOrthographicCamera) {
            g.position.copy(parentWorld);
            g.rotation.setFromQuaternion(parentOrient);
            return;
        }

        cam.getWorldQuaternion(camOrient)

        const snap = (value: number, size: number) => Math.round(value / size) * size;

        const worldUnitsPerPixel = (cam.top - cam.bottom) / cam.zoom / gl.domElement.height;
        const worldUnitsPerPixel2 = (cam.right - cam.left) / cam.zoom / gl.domElement.width;

        // camera basis vectors
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camOrient);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camOrient);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camOrient);

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

        //g.position.copy(parentWorld);

        g.rotation.setFromQuaternion(parentOrient)

        // Update Canvas Offset 
        /*
        const client_width = gl.domElement.clientWidth;
        const pixel_scale = client_width / gl.domElement.width;
        const screen_offsetX = -pixel_scale * (x - snappedX) / worldUnitsPerPixel2;
        const screen_offsetY = pixel_scale * (y - snappedY) / worldUnitsPerPixel;
        let scale = gl.domElement.height / (gl.domElement.height - 1);
        gl.domElement.style.transform = `scale(${scale}) translate(${screen_offsetX}px, ${screen_offsetY}px)`;
        */

        cam.userData["pixel_grid_offset"] = [snappedX / worldUnitsPerPixel2, -snappedY / worldUnitsPerPixel];
    }, -10)




    return <group ref={parentRef}>
        <group ref={groupRef}>{children}</group>
    </group>
}



export function KnightLevel() {

    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <>
                        <PP_Vignette />
                        {1 && <PP_PalDither palette="ty-disaster-girl-20-1x.png" dither={0.01} />}
                    </>}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>
        }


        <Pixelated resolution={256} enabled={true} />

        <group name="Lights">
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 5, 0]} intensity={0.5} />
        </group>

        <TerrainProvider textureUrl="textures/HFs/height.png">

            <Player camera_props={{ defaultZ: 9, default_pitch: 15, default_yaw: 180, head_y: 2.75 }} show_sphere={false}>
                <WorldPositionConstraint>
                    {1 && <TerrainPlane />}
                </WorldPositionConstraint>
                {1 && <MoveByVel speed={0.5} />}
                <Jump />
                <GroundClamp />

                {0 && <Knight />}
                <ImmortalLeva />
            </Player>

            {1 && <>
                {1 && <GrassScatter />}
                {1 && <PinesScatter />}
                {1 && <SnowSpritesUI active={true} showControls={true} fallSpeed={0.0} areaSize={100} count={1000} />}
                {0 && <DynamicWaterSystemToggle />}
            </>}

        </TerrainProvider>

        {0 && <SimpleBackground />}
    </>
}






