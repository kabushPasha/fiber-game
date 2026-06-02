import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import { atomicAdd, If, instanceIndex, storage, vec4 } from "three/tsl";
import { usePlayer } from "../../Player/PlayerContext";
import { Fn } from "three/src/nodes/TSL.js";
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow";
import { StorageBufferAttribute } from "three/webgpu";
import { useUI } from "../../../components/UIScreenContext";
import { Badge, ProgressBar } from "react-bootstrap";


// playerStore.ts
import { create } from "zustand";

type PlayerStore = {
    hp: number;
    damage: (amount: number) => void;
    heal: (amount: number) => void;
    setHp: (hp: number) => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
    hp: 100,

    damage: (amount) =>
        set((state) => ({
            hp: Math.max(0, state.hp - amount),
        })),

    heal: (amount) =>
        set((state) => ({
            hp: state.hp + amount,
        })),

    setHp: (hp) => set({ hp }),
}));



export function VatCrowds_LevelGame() {
    const mouseLock = useMouseLock()

    const [run, setRun] = useState(0);

    useEffect(() => {
        console.log("change");
        mouseLock.setLockOnClick(false)
    }, [])

    return <>
        <Pixelated resolution={512} enabled={true} />
        <LevelResetHandler setRun={setRun} />

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

            {0 && <RingBufferTest />}

        </TerrainProvider >
    </>
}

type LevelResetHandlerProps = {
    setRun: React.Dispatch<React.SetStateAction<number>>;
};

export function LevelResetHandler({ setRun }: LevelResetHandlerProps) {
    const hp = usePlayerStore((s) => s.hp);
    const setHp = usePlayerStore((s) => s.setHp);

    useEffect(() => {
        if (hp <= 0) {
            console.log("Player died");

            // Reset player state
            setHp(100);

            // Reset level here
            setRun((prev) => (prev + 1));
        }
    }, [hp, setHp]);

    return null;
}

export function BasicPerspCamera() {
    const { camera } = useThree()
    return <GameObject3D name="PlayerNeck" rotation={[degToRad(-60), 0, 0]}>
        <primitive object={camera} position={[0, 0, 40]} />
    </GameObject3D>
}






export function SurvivorsCharacterScatter() {
    const damage = usePlayerStore((s) => s.damage);

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

            <PlayerHitCounter onHit={(hits) => { damage(hits * 50); }} />

            {1 && <PlayerHP_UI />}

        </TransformsBufferProvider>
    </GridScatter>
}


type PlayerHitCounterProps = {
    onHit?: (hits: number) => void;
};

export function PlayerHitCounter({ onHit }: PlayerHitCounterProps) {
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

                If(worldPos.sub(player.tsl_PlayerWorldPosition).length().lessThan(1),
                    () => { atomicAdd(hitCounter.element(0), 1) }
                );

            });
        })().compute(count)
    }, [instanceMatrix, player.tsl_PlayerWorldPosition, hitCounter])


    const renderer = useWebGPURenderer()

    useFrame(async (_, delta) => {
        hitCounterAtt.array[0] = 0;
        hitCounterAtt.needsUpdate = true;
        renderer.compute(computeHits);
        const data = await renderer.getArrayBufferAsync(hitCounterAtt);
        const hits = new Uint32Array(data)[0];
        //console.log(hits);
        onHit?.(hits * delta);
    })

    return null;
}

export function PlayerHP_UI() {
    const ui = useUI();

    useEffect(() => {
        const unmount = ui.mount(() => <PlayerHPContent />);
        return unmount;
    }, [ui]);

    return null;
}

function PlayerHPContent() {
    const hp = usePlayerStore((s) => s.hp);

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
            <ProgressBar
                now={hp}
                label={hp.toFixed(1)}
                variant="danger"
            />
        </div>
    );
}