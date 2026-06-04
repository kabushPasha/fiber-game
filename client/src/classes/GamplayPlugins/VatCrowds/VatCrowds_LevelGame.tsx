import { createContext, useContext, useEffect, useMemo,   type PropsWithChildren } from "react";
import { Pixelated } from "../../../components/Pixelated";
import { ImmortalLeva } from "../../LEVELS/Assets/Characters/Knight";
import { useMouseLock } from "../../Player/MouseLock";
import { Player } from "../../Player/Player";
import { GroundClamp, MoveByVel } from "../../Player/PlayerPhysics";
import { TerrainProvider } from "../../Terrain/TerrainProvider";
import { createPositionsBuffer, createTransformsBuffer, createVelocityBuffer, RingBufferTest, type FloatBuffer } from "./RingBuffer";
import {   TexturedTerrain, Vat_Character } from "./VatCrowds_Level";
import { useFrame, useThree } from "@react-three/fiber";
import { GameObject3D } from "../../GameObjectContext";
import { degToRad } from "three/src/math/MathUtils.js";
import {  SnappedRelativePosition } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import { atomicAdd, deltaTime,  If, instanceIndex,  mix,  PI2, rand, storage, vec2, vec3 } from "three/tsl";
import { usePlayer } from "../../Player/PlayerContext";
import { Fn } from "three/src/nodes/TSL.js";
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow";
import { StorageBufferAttribute, StorageInstancedBufferAttribute } from "three/webgpu";
import { useUI } from "../../../components/UIScreenContext";
import {  ProgressBar } from "react-bootstrap";
import { useTransformsBufferContext} from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import * as THREE from "three/webgpu";

// playerStore.ts
import { create } from "zustand";
import { NgbGrid_Collide2D } from "./Horde/2dNbrGrid";

type PlayerStore = {
    hp: number;
    run: number;
    damage: (amount: number) => void;
    heal: (amount: number) => void;
    setHp: (hp: number) => void;
    restart: () => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
    hp: 100,
    run: 0,
    damage: (amount) =>
        set((state) => {
            const hp = Math.max(0, state.hp - amount);

            if (hp === 0) {
                return {
                    hp: 100,
                    run: state.run + 1,
                };
            }

            return { hp };
        }),

    heal: (amount) =>
        set((state) => ({
            hp: state.hp + amount,
        })),

    setHp: (hp) => set({ hp }),

    restart: () =>
        set((state) => ({
            run: state.run + 1,
        })),
}));



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
            <HordeSolver >
                <Vat_Character count={700} />
                <Vat_Character count={200} offset={700} url="models/Char/VatChar/OrkKing.glb" />
            </HordeSolver>

            {1 && <PlayerHP_UI />}


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
        <primitive object={camera} position={[0, 0, 60]} />
    </GameObject3D>
}

// HORDER Context -------------------------------------------------
export interface HordeContextType {
    pos_buffer: FloatBuffer,
}
export const useHordeContext = createContext<HordeContextType | undefined>(undefined);
export function useHorde(): HordeContextType {
    const ctx = useContext(useHordeContext);
    if (!ctx) { throw new Error("useProject must be used within Horde Provider"); }
    return ctx;
}

// HORDER Solver --------------------------------------------------
export function HordeSolver({ children }: PropsWithChildren) {
    const renderer = useWebGPURenderer()
    const count = 1000;

    const run = usePlayerStore((s) => s.run);

    const player = usePlayer()
    const damage = usePlayerStore((s) => s.damage);
    const transformsBuffer = createTransformsBuffer(count);
    const pos_buffer = createPositionsBuffer(count);
    const vel_buffer = createVelocityBuffer(count);


    const spawnTimer = useMemo(() => {
        // Spawn Timer
        const spawnTimerAttribute = new StorageInstancedBufferAttribute(new Float32Array(count), 1);
        const spawnTimerBuffer = storage(spawnTimerAttribute).setPBO(true)

        const age = spawnTimerBuffer.element(instanceIndex);
        const active = age.greaterThanEqual(0);

        return { spawnTimerAttribute, spawnTimerBuffer, age, active }
    }, [count])

    const playerHitCounter = useMemo(() => {
        const hitCounterAtt = new StorageBufferAttribute(new Uint32Array(1), 1);
        const hitCounterStorage = storage(hitCounterAtt, 'uint', 1).setPBO(true).toAtomic()

        const resetHits = () => {
            hitCounterAtt.array[0] = 0;
            hitCounterAtt.needsUpdate = true;
        }

        const readHits = async () => {
            const data = await renderer.getArrayBufferAsync(hitCounterAtt);
            const hits = new Uint32Array(data)[0];
            return hits;
        }

        return { hitCounterStorage, hitCounterAtt, resetHits, readHits }
    }, [])

    //Reset
    useEffect(() => {
        // Init Values
        console.log("reset");
        const values = Array.from({ length: count }, (_, i) => -i * 0.2);
        spawnTimer.spawnTimerAttribute.array.set(values)
        spawnTimer.spawnTimerAttribute.needsUpdate = true;

        transformsBuffer.reset();
    }, [spawnTimer,run])

    // update Fn
    const computeUpdate = useMemo(() => {
        const creature_speed = 3.;
        const turn_speed = 20.0;
        const spawn_radius = 40.0;
        const wrap_radius = 200;

        return Fn(() => {
            If(instanceIndex.lessThan(count), () => {
                const dt = deltaTime;
                spawnTimer.age.addAssign(dt);

                If(spawnTimer.active, () => {

                    // Spawn Event
                    If(spawnTimer.age.sub(dt).lessThanEqual(0), () => {
                        pos_buffer.element.assign(player.tsl_PlayerWorldPosition.add(
                            random_2d_dir().mul(spawn_radius)
                        ));
                        vel_buffer.element.assign(random_2d_dir(vec2(instanceIndex, 3)).mul(creature_speed));
                        transformsBuffer.utils.toUnitmatrix(2);
                    })

                    // Rotate Towards Player            
                    const toPlayer = player.tsl_PlayerWorldPosition.sub(pos_buffer.element).normalize();
                    const turnSpeed = dt.mul(turn_speed);
                    const newForward = mix(vel_buffer.element, toPlayer, turnSpeed).normalize().mul(vel_buffer.element.length());
                    vel_buffer.element.assign(newForward);

                    // Move POS by VEL
                    pos_buffer.element.addAssign(vel_buffer.element.mul(deltaTime));
                    // Wrap Around Player
                    const player_relative_pos = SnappedRelativePosition(pos_buffer.element, player.tsl_PlayerWorldPosition, wrap_radius);
                    const wrapped_world = player_relative_pos.add(player.tsl_PlayerWorldPosition);
                    pos_buffer.element.assign(wrapped_world);

                    // Damage Player
                    If(pos_buffer.element.sub(player.tsl_PlayerWorldPosition).length().lessThan(1),
                        () => { atomicAdd(playerHitCounter.hitCounterStorage.element(0), 1) }
                    );

                    // Set Transform If Alive                
                    transformsBuffer.utils.setPosition(pos_buffer.element);
                    transformsBuffer.utils.orientFromVel(vel_buffer.element);
                })
            });
        })().compute(count);
    }, [count, player.tsl_PlayerWorldPosition, spawnTimer]);


    useFrame(async (_, delta) => {
        playerHitCounter.resetHits();
        renderer.compute(computeUpdate)
        const hits = await playerHitCounter.readHits();
        damage(hits * 50 * delta);
    })


    return <useTransformsBufferContext.Provider value={transformsBuffer}>
        <useHordeContext.Provider value={{ pos_buffer }}>
            <NgbGrid_Collide2D />
            {children}
        </useHordeContext.Provider>
    </useTransformsBufferContext.Provider>;
}




export function PlayerHP_UI() {
    const ui = useUI();

    useEffect(() => {
        const unmount = ui.mount(() => <PlayerHPContent />);
        console.log("Mount UI");
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


export const random_2d_dir = (uv: THREE.Node = instanceIndex) => {
    return vec3(
        rand(uv).mul(PI2).sin(),
        0,
        rand(uv).mul(PI2).cos()
    )
}