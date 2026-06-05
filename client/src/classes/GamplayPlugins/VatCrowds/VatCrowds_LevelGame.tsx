import { createContext, useCallback, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { Pixelated } from "../../../components/Pixelated";
import { ImmortalLeva } from "../../LEVELS/Assets/Characters/Knight";
import { useMouseLock } from "../../Player/MouseLock";
import { Player } from "../../Player/Player";
import { GroundClamp, MoveByVel } from "../../Player/PlayerPhysics";
import { TerrainProvider } from "../../Terrain/TerrainProvider";
import { createFloatBuffer, createPositionsBuffer, createRingBuffer, createTransformsBuffer, createVelocityBuffer, useTimer, type FloatBuffer } from "./RingBuffer";
import { TexturedTerrain, Vat_Character } from "./VatCrowds_Level";
import { useFrame } from "@react-three/fiber";
import { InstancedMeshSimple, InstancedTransformMaterial, SnappedRelativePosition } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import { atomicAdd, deltaTime, If, instanceIndex, mix, storage, vec2 } from "three/tsl";
import { usePlayer } from "../../Player/PlayerContext";
import { Fn } from "three/src/nodes/TSL.js";
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow";
import { StorageBufferAttribute, StorageInstancedBufferAttribute } from "three/webgpu";
import { useTransformsBufferContext } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import * as THREE from "three/webgpu";


import { NbrGridFollowPlayer,  pbdRepelCompute } from "./Horde/2dNbrGrid";
import { CursorGroundHit, CursorGroundMarker } from "./Horde/CursorGroundIntersector";
import { usePlayerStore } from "./Horde/PlayerStore_Horde";
import { BasicPerspCamera } from "./Horde/BasicPerspCamera";
import { PlayerHP_UI } from "./Horde/PlayerHP_UI";
import { random_2d_dir } from "./Horde/horde_tsl_utils";



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

            {1 && <BasicProjectile />}

        </TerrainProvider >

        <CursorGroundHit />
        <CursorGroundMarker />

    </>
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

    const horde_nbr_grid = usePlayerStore.getState().horde_nbr_grid;

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
    }, [spawnTimer, run])

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

    // Fill NBR Grid
    const fillGridCompute = useMemo(() => {
        return Fn(() => {
            If(instanceIndex.lessThan(pos_buffer.count), () => {
                If(spawnTimer.active, () => {
                    const offset = pos_buffer.element;
                    horde_nbr_grid.insertParticle(offset, instanceIndex)
                })
            })
        })().compute(pos_buffer.count);
    }, [horde_nbr_grid, pos_buffer, spawnTimer])

    const pbdCompute = useMemo(() => {
        return pbdRepelCompute(
            pos_buffer.bufferNode,
            horde_nbr_grid,
            pos_buffer.count,
            2.0,
            0.2
        ).compute(pos_buffer.count);
    }, [horde_nbr_grid, pos_buffer])


    useFrame(async (_, delta) => {
        // Reset Player Hits
        playerHitCounter.resetHits();
        // Sim Horde
        renderer.compute(computeUpdate)
        // PBD Pass
        await renderer.computeAsync(horde_nbr_grid.clearCompute())
        await renderer.computeAsync(fillGridCompute)
        await renderer.computeAsync(horde_nbr_grid.computeMirror())
        await renderer.computeAsync(pbdCompute)
        // Read Hits
        const hits = await playerHitCounter.readHits();
        damage(hits * 50 * delta);
    })

    return <useTransformsBufferContext.Provider value={transformsBuffer}>

            <primitive object={horde_nbr_grid.createDebugMesh()} />
            <NbrGridFollowPlayer nbr_grid={horde_nbr_grid} />

            {children}
    </useTransformsBufferContext.Provider>;
}


export function BasicProjectile({ children }: PropsWithChildren) {
    const size = 32;
    const transformsBuffer = createTransformsBuffer(size);
    const pos_buffer = createPositionsBuffer(size);
    const vel_buffer = createVelocityBuffer(size);

    const alive_buffer = createFloatBuffer(size, 1, Uint8Array);
    const age_buffer = createFloatBuffer(size, 1, Float32Array);


    const player = usePlayer()
    const renderer = useWebGPURenderer();

    const onSpawn = useCallback(() => {
        pos_buffer.element.assign(player.tsl_PlayerWorldPosition);
        transformsBuffer.utils.toUnitmatrix();
        transformsBuffer.utils.setPosition(pos_buffer.element);

        const to_cursor_vel = usePlayerStore.getState().cursorHitUniform.sub(
            player.tsl_PlayerWorldPosition).normalize().mul(50)
        vel_buffer.element.assign(to_cursor_vel);
        transformsBuffer.utils.orientFromVel(vel_buffer.element);
        age_buffer.element.assign(0.0);
        alive_buffer.element.assign(1.0);
    }, [])

    const ringBuffer = createRingBuffer({ size, onSpawn });

    // Spawn on E
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.code == "KeyE") { ringBuffer.spawnCount(1); } }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    // Spawn on Timew
    useTimer(0.5, () => { ringBuffer.spawnCount(1); });

    //move by vel
    const computeUpdate = useCallback(() => {
        const max_age = 0.5;

        const fn = Fn(() => {
            // Process Only Alive ones
            If(alive_buffer.element.notEqual(0), () => {
                // Increment Age
                age_buffer.element.addAssign(deltaTime);
                If(age_buffer.element.greaterThan(max_age), () => {
                    //vel_buffer.element.mulAssign(0);
                    alive_buffer.element.assign(0);
                    transformsBuffer.utils.toUnitmatrix(0.0);
                })

                // Move POS by VEL
                pos_buffer.element.addAssign(vel_buffer.element.mul(deltaTime));
                // DRAG VEL
                //vel_buffer.element.mulAssign(0.99);
                // move pos to transforms buffer
                transformsBuffer.utils.setPosition(pos_buffer.element);
                // Orient only if we have vel
                /*
                If(vel_buffer.element.length().greaterThan(0), () => {
                    transformsBuffer.utils.orientFromVel(vel_buffer.element);})
                */
            })

        });
        return renderer.compute(fn().compute(size))
    }, [pos_buffer, vel_buffer, size, renderer])

    useFrame(() => {
        computeUpdate();
    })

    return <useTransformsBufferContext.Provider value={transformsBuffer}>
        {children}
        <InstancedMeshSimple >
            <boxGeometry />
            <InstancedTransformMaterial />
        </InstancedMeshSimple>
    </useTransformsBufferContext.Provider>;
}
