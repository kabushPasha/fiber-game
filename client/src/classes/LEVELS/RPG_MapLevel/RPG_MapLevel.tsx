import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { GroundClamp, MoveByVel } from "../../Player/PlayerPhysics";
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext";
import { PP_Vignette } from "../../PostProcessing/Effects/PP_Dof";
import { PP_FogPass } from "../../PostProcessing/Effects/PP_FogPass";
import { WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext";
import { SimpleBackground } from "../../shaders/Aurora";
import { TerrainProvider, useTerrain } from "../../Terrain/TerrainProvider";


import * as THREE from "three";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { float, modelWorldMatrix, modelWorldMatrixInverse, positionLocal, texture, vec3, vec4 } from "three/tsl";
import { usePlayer } from "../../Player/PlayerContext";
import { Sphere, useKeyboardControls } from "@react-three/drei";
import { useMouseLock } from "../../Player/MouseLock";
import { GameObject3D } from "../../GameObjectContext";
import { LZ_CamerOrientationController } from "../../Player/CameraController";
import { SmoothChild } from "../../ParentConstraints/SmoothChild";


export function RPG_MapLevel() {

    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    <PP_FogPass density={0.005} heightFalloff={0.02} start_distance={150} />
                    <PP_Vignette />
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>
        }

        <TerrainProvider textureUrl="textures/HFs/ff1_hf_1k_test.exr" hf_height={100} hf_size={256}>
            <RPG_Player>
                <RPG_ParentWorldPositionConstraint>
                    {1 && <RPG_Terrain_Plane />}
                </RPG_ParentWorldPositionConstraint>

                <MoveByVel />
                <GroundClamp />
            </RPG_Player>

        </TerrainProvider>

        {1 && <SimpleBackground />}
    </>
}



export function RPG_Terrain_Plane() {
    const ref = useRef<THREE.Group>(null!);

    const hf_C = useLoader(THREE.TextureLoader, "textures/HFs/ff1_C.png");
    hf_C.wrapS = THREE.RepeatWrapping;
    hf_C.wrapT = THREE.RepeatWrapping;
    hf_C.colorSpace = THREE.SRGBColorSpace;

    const { hf_size, width,  tsl_sampleHeight,  tsl_ws2sample } = useTerrain();

    // here we can set block size to be smaller than texel for testing
    const block_size = hf_size / (width - 1) * 1.0;
    //here we can set number of terrain repeats
    const n_blocks = width * 3 + 1; 
    const size = block_size * (n_blocks);

    useFrame(() => {
        const parent = ref.current.parent!;
        ref.current.position.setX(-parent.position.x % block_size);
        ref.current.position.setZ(-parent.position.z % block_size);
    });

    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();
        mat.side = THREE.DoubleSide

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal.xyz, 1));
        const heightSample = tsl_sampleHeight(worldPos);

        const new_pos = worldPos.setY(heightSample);
        const localPos = modelWorldMatrixInverse.mul(new_pos).xyz;
        mat.positionNode = localPos;

        const samplePos = tsl_ws2sample(worldPos.toVertexStage());
        const C = texture(hf_C, samplePos);

        mat.colorNode = vec3(0, 0, 0);
        mat.emissiveNode = C.mul(0.5);

        const R = float(1500.0);
        const x = positionLocal.x;
        const y = positionLocal.y;
        const dist = x.mul(x).add(y.mul(y)).sqrt();
        // Correct angle: atan2(y, x)
        const fi = y.atan(x);
        // Angular distance
        const Theta = dist.div(R);

        const spherePos = vec3(
            R.mul(Theta.sin()).mul(fi.cos()),
            R.mul(Theta.sin()).mul(fi.sin()),
            R.mul(Theta.cos())
        );

        mat.positionNode = spherePos
            .sub(vec3(0, 0, R))
            .add(spherePos.normalize().mul(heightSample));

        return mat;
    }, [hf_size, width, tsl_sampleHeight, hf_C]);


    return (
        <group name="TerrainPlane" ref={ref} >
            <mesh rotation-x={-Math.PI / 2} material={material} receiveShadow name="TerrainPlaneMesh" raycast={() => { }}>
                <planeGeometry args={[size, size, n_blocks, n_blocks]} />
            </mesh>
        </group>
    );
}


const SPEED = 10
const SPRINT_SPEED = 45 // sprint speed

interface PlayerProps {
    children?: ReactNode,
    show_sphere?: boolean,
}

export function RPG_Player({ children, show_sphere = true}: PlayerProps) {
    const playerRef = useRef<THREE.Group>(null!);
    // Register Our Player
    const { setPlayer } = usePlayer()

    useEffect(() => {
        if (playerRef.current) setPlayer(playerRef.current)
    }, [playerRef, setPlayer])

    const [, get] = useKeyboardControls()
    const { } = useThree()

    const { isLocked, lockOnClick } = useMouseLock()

    const currentSpeed = useRef(SPEED)

    const orient = new THREE.Quaternion()
    const player_forward = new THREE.Vector3()
    const player_right = new THREE.Vector3()

    useFrame((_, delta) => {
        if (!(isLocked || !lockOnClick)) return

        const { forward, backward, left, right, shift } = get()

        // Target Speed
        const targetSpeed = shift ? SPRINT_SPEED : SPEED
        currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, targetSpeed, 10, delta)

        // get camera Directions
        playerRef.current.getWorldQuaternion(orient)
        player_forward.set(0, 0, -1).applyQuaternion(orient)
        player_right.set(1, 0, 0).applyQuaternion(orient)

        // Input Vectors
        const z = (Number(forward) - Number(backward))
        const x = (Number(right) - Number(left))

        // construct move
        const move = new THREE.Vector3()
        move.addScaledVector(player_forward, z)
        move.addScaledVector(player_right, x)

        const vel = playerRef.current.userData.vel

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(currentSpeed.current)
            vel.x = move.x
            vel.z = move.z
        } else {
            vel.x = 0
            vel.z = 0
        }

    }, -10)


    useEffect(() => {
        if (!playerRef.current.userData.vel)
            playerRef.current.userData.vel = new THREE.Vector3(0, 0, 0)
    }, [playerRef])

    return (
        <>

            <GameObject3D ref={playerRef} name="Player" position={[52, 0, 53]}>
                {children}

                <LZ_CamerOrientationController default_yaw={150} default_pitch={45}>
                    <RPG_Camera defaultZ={85} />
                </LZ_CamerOrientationController>

                {show_sphere && <Sphere scale={0.5} />}
            </GameObject3D>

        </>
    )
}


type SmoothCameraProps = {
    smooth?: number,
    defaultZ?: number,
}

export function RPG_Camera({
    smooth = 6,
    defaultZ = 0,
}: SmoothCameraProps) {

    const { camera } = useThree()
    const targetZ = useRef(0) // target for smooth scroll

    // WHEEL ZOOM
    useEffect(() => {
        const onWheel = (e: WheelEvent) => {
            targetZ.current += e.deltaY * 0.01 // adjust scroll speed
            targetZ.current = Math.max(0, targetZ.current) // clamp to positive Z
        }

        document.addEventListener("wheel", onWheel)

        targetZ.current = defaultZ
        camera.position.z = defaultZ

        return () => {
            document.removeEventListener("wheel", onWheel)
        }
    }, [defaultZ])

    useFrame(() => {
        camera.position.z += (targetZ.current - camera.position.z) * 0.1 // smooth factor    
    })

    return (
        <>
            <SmoothChild smooth={smooth}>
                <primitive object={camera} />
            </SmoothChild>
        </>
    )
}


type WorldPositionConstraintProps = React.PropsWithChildren<{}>

function RPG_ParentWorldPositionConstraint({ children }: WorldPositionConstraintProps) {
    const { scene } = useThree()

    const groupRef = useRef<THREE.Group>(null!)
    const parentRef = useRef<THREE.Group>(null!)
    const parentWorld = new THREE.Vector3()

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
        const parent = parentRef.current
        const g = groupRef.current
        if (!parent || !g) return

        parent.getWorldPosition(parentWorld)
        g.position.copy(parentWorld)
        g.position.setComponent(1, 0);
    }, -5)

    return <group ref={parentRef}>
        <group ref={groupRef}>{children}</group>
    </group>
}