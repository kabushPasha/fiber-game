import { KeyboardControls } from "@react-three/drei";
import { folder, useControls } from "leva";
import { useMemo, useRef } from "react";
import * as THREE from 'three/webgpu'
import { useFrame } from "@react-three/fiber";
import { float, modelWorldMatrix, positionLocal, vec4 } from "three/tsl";
import { PlayerProvider, usePlayer } from "../../Player/PlayerContext";
import { MouseLockProvider } from "../../Player/MouseLock";
import { inputMap } from "../../../App";
import { SimpleBackground } from "../../shaders/Aurora";
import { Player } from "../../Player/Player";
import { GroundClampSimple, Jump, MoveByVel } from "../../Player/PlayerPhysics";
import { useWebGPURenderer } from "../ScatterAPI/Scatter/SatinFlow";



export function SimGridPresetLevel() {

    return <PlayerProvider>
            <MouseLockProvider>
                <KeyboardControls map={inputMap} >

                    <group name="Lights">
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[10, 5, 0]} intensity={0.6} />
                    </group>

                    <SimpleBackground />

                    <Player >
                        <MoveByVel />
                        <Jump />
                        <GroundClampSimple />
                    </Player>


                </KeyboardControls>
            </MouseLockProvider>
        </PlayerProvider>;  
}




export function SimGridPreset() {

    const controls = useControls("Terrain", {
        DryIce: folder({
            res: { value: 256, min: 4, max: 1024, step: 1 },
            size: { value: 64, min: 1, max: 200 },
            wireframe: { value: false },
        }, { collapsed: false })
    });

    const { res, size, wireframe } = controls;
    const ref = useRef<THREE.Mesh>(null!);
    const player = usePlayer()
    const renderer = useWebGPURenderer()
    const dispatch_size = useMemo(() => res / 16, [res])
    const block_size = useMemo(() => { return size / (res - 1) }, [res, size]);

    
    const frame = useRef(0)
    useFrame(() => {

        if (frame.current % 2 == 0) {
            // Update Position
            const pwp = player.playerWorldPosition;            
            //ref.current.position.setX(pwp.x - pwp.x % block_size);
            //ref.current.position.setZ(pwp.z - pwp.z % block_size);

            //renderer.compute(BufferAProgram, [dispatch_size, dispatch_size, 1]);
            //renderer.compute(StorageBufferA.writebackCompute, [dispatch_size, dispatch_size, 1]);


        }
        frame.current += 1;

    })

    // Material
    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.wireframe = wireframe;
        mat.colorNode = float(0.0);

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1));
        const worldUv = worldPos.xz.div(size);

        return mat;
    }, [res, size, wireframe])

    // res should be res-1 to match the thing
    return <group ref={ref} >
        <mesh
            rotation={[-Math.PI * 0.5, 0, 0]}
            position={[0, 0, 0]}
            material={material}
        //renderOrder={998}
        >
            <planeGeometry args={[size*1, size*1, res-1, res-1]} />
        </mesh>

    </group>



}