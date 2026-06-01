import { useEffect, useMemo } from "react";
import { Pixelated } from "../../../components/Pixelated";
import { ImmortalLeva } from "../../LEVELS/Assets/Characters/Knight";
import { useMouseLock } from "../../Player/MouseLock";
import { Player } from "../../Player/Player";
import { GroundClamp, MoveByVel } from "../../Player/PlayerPhysics";
import { TerrainProvider } from "../../Terrain/TerrainProvider";
import { RingBufferTest } from "./RingBuffer";
import { MoveByOrient, NgbGrid_Collide, TexturedTerrain, Vat_Character } from "./VatCrowds_Level";
import { useFrame, useThree } from "@react-three/fiber";
import { GameObject3D } from "../../GameObjectContext";
import { degToRad } from "three/src/math/MathUtils.js";
import { GridScatter, TransformsBufferProvider, useTransformsBuffer, WrapAroundPlayerGPU } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import { atomicAdd,  If, instanceIndex, storage,  vec4 } from "three/tsl";
import { usePlayer } from "../../Player/PlayerContext";
import { Fn } from "three/src/nodes/TSL.js";
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow";
import { StorageBufferAttribute } from "three/webgpu";



export function VatCrowds_LevelGame() {
    const mouseLock = useMouseLock()

    useEffect(() => {
        console.log("change");
        mouseLock.setLockOnClick(false)
    }, [])



    return <>

        <Pixelated resolution={512} enabled={true} />


        <TerrainProvider textureUrl="textures/HFs/height.png" hf_height={0}>

            <Player show_sphere={false} create_camera={false}>

                <MoveByVel speed={0.5} />
                <GroundClamp />
                {1 && <ImmortalLeva />}

                <BasicPerspCamera />

            </Player>

            {/** <Vat_Character />*/}
            {1 && <SurvivorsCharacterScatter />}


            {/** <Vat_Character />*/}
            {1 && <TexturedTerrain />}

            {1 && <RingBufferTest />}

        </TerrainProvider >
    </>
}


export function BasicPerspCamera() {
    const { camera } = useThree()
    return <GameObject3D name="PlayerNeck" rotation={[degToRad(-60), 0, 0]}>
        <primitive object={camera} position={[0, 0, 40]} />
    </GameObject3D>
}



export function SurvivorsCharacterScatter() {


    return <GridScatter
        name={"Warriors"}
        spacing={10}
        cellCount={30}
        scale={2}
        rotation_random={1}
        offset_random={3}
        scale_random={0.3}
        shuffele={true}
    >
        <TransformsBufferProvider>
            <Vat_Character count={700} />
            <Vat_Character count={200} offset={700} url="models/Char/VatChar/OrkKing.glb" />

            <MoveByOrient speed={3} />

            <WrapAroundPlayerGPU />

            <NgbGrid_Collide />

            <PlayerHitCounter />

        </TransformsBufferProvider>
    </GridScatter>
}


export function PlayerHitCounter() {

    const [hitCounter, hitCounterAtt] = useMemo(() => {
        const hitCounterAtt = new StorageBufferAttribute(new Uint32Array(1), 1);
        const hitCounterStorage = storage(
            hitCounterAtt
            , 'uint', 1
        ).setPBO(true).toAtomic()

        return [hitCounterStorage, hitCounterAtt]
    }, [])

    const { transformsBufferNode, count } = useTransformsBuffer();

    const player = usePlayer()

    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])


    const computeHits = useMemo(() => {
        return Fn(() => {
            If(instanceIndex.lessThan(count), () => {
                const worldPos = instanceMatrix.mul(vec4(0, 0, 0, 1));

                If(worldPos.sub(player.tsl_PlayerWorldPosition).length().lessThan(2),
                    () => {
                        atomicAdd(hitCounter.element(0), 1)
                    }
                );

            });
        })().compute(count)
    }, [instanceMatrix, player.tsl_PlayerWorldPosition, hitCounter])


    const renderer = useWebGPURenderer()

    useFrame(async () => {

        hitCounterAtt.array[0] = 0;
        hitCounterAtt.needsUpdate = true;

        renderer.compute(computeHits);
        const data = await renderer.getArrayBufferAsync(hitCounterAtt);
        const hits = new Uint32Array(data)[0];
        console.log(hits);
    })

    return null;

}
