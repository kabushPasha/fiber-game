import { useCallback, useEffect, useMemo, type PropsWithChildren } from "react";
import { Pixelated } from "../../../components/Pixelated";
import { ImmortalLeva } from "../../LEVELS/Assets/Characters/Knight";
import { useMouseLock } from "../../Player/MouseLock";
import { Player } from "../../Player/Player";
import { GroundClamp, MoveByVel } from "../../Player/PlayerPhysics";
import { TerrainProvider } from "../../Terrain/TerrainProvider";
import { createFloatBufferMemo, createRingBuffer, createTransformsBufferMemo, useTimer } from "./RingBuffer";
import { TexturedTerrain, Vat_Character } from "./VatCrowds_Level";
import { useFrame } from "@react-three/fiber";
import { InstancedMeshSimple, InstancedTransformMaterial, SnappedRelativePosition } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import { atomicAdd, atomicLoad, atomicStore, atomicSub, deltaTime, float, If, instanceIndex, int, ivec2, Loop, mix, storage, vec2, vec3, vec4 } from "three/tsl";
import { usePlayer } from "../../Player/PlayerContext";
import { Fn } from "three/src/nodes/TSL.js";
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow";
import { StorageBufferAttribute, StorageInstancedBufferAttribute } from "three/webgpu";
import { useTransformsBufferContext } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import * as THREE from "three/webgpu";


import { NbrGridFollowPlayer, pbdRepelCompute } from "./Horde/2dNbrGrid";
import { CursorGroundHit, CursorGroundMarker } from "./Horde/CursorGroundIntersector";
import { useHordeStore } from "./Horde/PlayerStore_Horde";
import { BasicPerspCamera } from "./Horde/BasicPerspCamera";
import { PlayerHP_UI } from "./Horde/PlayerHP_UI";
import { random_2d_dir } from "./Horde/horde_tsl_utils";
import type { NeighbourGrid2D } from "../../Terrain/ECS/NbrGrid2D";



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

        <PlayerDataUpdater />
    </>
}


export function PlayerDataUpdater() {
    const player = usePlayer()
    const playerData = useHordeStore.getState().playerData;

    useEffect(() => {
        playerData.player = player.player;
        playerData.playerWorldPosition = player.playerWorldPosition;
        playerData.tsl_PlayerWorldPosition = player.tsl_PlayerWorldPosition;
        playerData.tsl_PlayerVelocity = player.tsl_PlayerVelocity;
    }, [player])

    return null
}



// HORDER Solver --------------------------------------------------
export function HordeSolver({ children }: PropsWithChildren) {
    const renderer = useWebGPURenderer()

    const run = useHordeStore((s) => s.run);
    //const player = usePlayer()
    const player = useHordeStore().playerData;
    const damage = useHordeStore((s) => s.damage);

    const horde = useHordeStore.getState().horde;
    const horde_nbr_grid = horde.nbr_grid;
    const count = horde.count;

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

        horde.transformsBuffer.reset();
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
                        horde.pos_buffer.element.assign(player.tsl_PlayerWorldPosition.add(
                            random_2d_dir().mul(spawn_radius)
                        ));
                        horde.vel_buffer.element.assign(random_2d_dir(vec2(instanceIndex, 3)).mul(creature_speed));
                        horde.transformsBuffer.utils.toUnitmatrix(2);
                        //atomicStore(horde.hp_buffer.element(instanceIndex), 1);
                    })



                    // Rotate Towards Player            
                    const toPlayer = player.tsl_PlayerWorldPosition.sub(horde.pos_buffer.element).normalize();
                    const turnSpeed = dt.mul(turn_speed);
                    const newForward = mix(horde.vel_buffer.element, toPlayer, turnSpeed).normalize().mul(horde.vel_buffer.element.length());
                    horde.vel_buffer.element.assign(newForward);

                    // Move POS by VEL
                    horde.pos_buffer.element.addAssign(horde.vel_buffer.element.mul(deltaTime));
                    // Wrap Around Player
                    const player_relative_pos = SnappedRelativePosition(horde.pos_buffer.element, player.tsl_PlayerWorldPosition, wrap_radius);
                    const wrapped_world = player_relative_pos.add(player.tsl_PlayerWorldPosition);
                    horde.pos_buffer.element.assign(wrapped_world);

                    // Damage Player
                    If(horde.pos_buffer.element.sub(player.tsl_PlayerWorldPosition).length().lessThan(1),
                        () => { atomicAdd(playerHitCounter.hitCounterStorage.element(0), 1) }
                    );

                    // Set Transform If Alive                
                    horde.transformsBuffer.utils.setPosition(horde.pos_buffer.element);
                    horde.transformsBuffer.utils.orientFromVel(horde.vel_buffer.element);


                    // Death Event
                    /*
                    const hp = float(atomicLoad(horde.hp_buffer.element(instanceIndex)))
                    If(hp.lessThanEqual(0), () => {
                        spawnTimer.age.assign(-10)
                        horde.transformsBuffer.utils.toUnitmatrix(0);s
                    });
                    */

                })
            });
        })().compute(count);
    }, [count, player.tsl_PlayerWorldPosition, spawnTimer]);

    // Fill NBR Grid
    const fillGridCompute = useMemo(() => {
        return Fn(() => {
            If(instanceIndex.lessThan(horde.pos_buffer.count), () => {
                If(spawnTimer.active, () => {
                    const offset = horde.pos_buffer.element;
                    horde_nbr_grid.insertParticle(offset, instanceIndex)
                })
            })
        })().compute(horde.pos_buffer.count);
    }, [horde_nbr_grid, horde.pos_buffer, spawnTimer])

    const pbdCompute = useMemo(() => {
        return pbdRepelCompute(
            horde.pos_buffer.bufferNode,
            horde_nbr_grid,
            horde.pos_buffer.count,
            2.0,
            0.2
        ).compute(horde.pos_buffer.count);
    }, [horde_nbr_grid, horde.pos_buffer])


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

    return <useTransformsBufferContext.Provider value={horde.transformsBuffer}>

        <primitive object={horde_nbr_grid.createDebugMesh()} />
        <NbrGridFollowPlayer nbr_grid={horde_nbr_grid} />

        {children}
    </useTransformsBufferContext.Provider>;
}


export function BasicProjectile({ children }: PropsWithChildren) {
    const proj_data = useHordeStore.getState().projectiles;
    const horde = useHordeStore.getState().horde;

    const count = proj_data.count;
    const transformsBuffer = proj_data.transformsBuffer;
    const pos_buffer = proj_data.pos_buffer;
    const vel_buffer = proj_data.vel_buffer;

    const alive_buffer = proj_data.alive_buffer;
    const age_buffer = proj_data.age_buffer;

    const player = usePlayer()
    const renderer = useWebGPURenderer();

    const onSpawn = useCallback(() => {
        const to_cursor_vel = useHordeStore.getState().cursorHitUniform.sub(
            player.tsl_PlayerWorldPosition).normalize().mul(50)

        proj_data.utils.initFromPosAndVel(player.tsl_PlayerWorldPosition, to_cursor_vel);
    }, [])

    const ringBuffer = createRingBuffer({ size: count, onSpawn });

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



                // Collide with enemies

                const grid = horde.nbr_grid;
                const cell2 = grid.posToIndex2TSL(pos_buffer.element);
                const linear = grid.index2ToLinearTSL(cell2)
                const base = grid.getCellBaseIndex(linear)
                // iterate fixed max per cell
                const countInCell = atomicLoad(grid.gridCounts.element(linear))
                If(countInCell.greaterThan(0), () => {
                    alive_buffer.element.assign(0);
                    transformsBuffer.utils.toUnitmatrix(0.0);
                })

                /*
                for (let i = 0; i < grid.maxPerCell; i++) {
                    If(int(i).lessThan(countInCell), () => {
                        const otherIndex = grid.gridParticles.element(base.add(int(i)))
                        //const otherPos = horde.pos_buffer.bufferNode.element(otherIndex)                        
                        atomicSub(horde.hp_buffer.element(otherIndex), 1);
                    })
                }
                */




            })

        });
        return renderer.compute(fn().compute(count))
    }, [pos_buffer, vel_buffer, count, renderer])

    useFrame(() => {
        computeUpdate();
    }, -5)

    return <useTransformsBufferContext.Provider value={transformsBuffer}>
        {children}
        <InstancedMeshSimple >
            <boxGeometry />
            <InstancedTransformMaterial />
        </InstancedMeshSimple>
    </useTransformsBufferContext.Provider>;
}





export const projHit = (
    pos: THREE.Node,
    posBuffer: THREE.StorageBufferNode,
    grid: NeighbourGrid2D,
    count: number,
    radius: number,
    strength: number

) => {

    If(instanceIndex.lessThan(count), () => {
        const cell2 = grid.posToIndex2TSL(pos)

        const size = 1;
        pos.assign(vec3(0, 0, 0));

        for (let oy = -size; oy <= size; oy++) {
            for (let ox = -size; ox <= size; ox++) {

                const neighborCell2 = cell2.add(ivec2(ox, oy));
                const linear = grid.index2ToLinearTSL(neighborCell2)
                const base = grid.getCellBaseIndex(linear)

                // iterate fixed max per cell
                const countInCell = atomicLoad(grid.gridCounts.element(linear))
                for (let i = 0; i < grid.maxPerCell; i++) {
                    If(int(i).lessThan(countInCell), () => {
                        const otherIndex = grid.gridParticles.element(base.add(int(i)))
                        const otherPos = posBuffer.element(otherIndex)

                        const dir = pos.xyz.sub(otherPos.xyz).mul(vec3(1, 0, 1))
                        const dist = dir.length()

                        If(dist.lessThan(float(radius)), () => {
                            const push = dir.normalize()
                                .mul(float(radius).sub(dist))
                                .mul(strength)

                            pos.addAssign(push)
                            pos.assign(vec3(0, 0, 0));
                        })
                    })
                }
            }
        }
    })

}