import { create } from "zustand";
import * as THREE from "three/webgpu";
import { storage, uniform } from "three/tsl";
import { NeighbourGrid2D } from "../../../Terrain/ECS/NbrGrid2D";
import { createFloatBuffer, createTransformsBuffer } from "../RingBuffer";

type HordeStore = {
    hp: number;
    run: number;
    damage: (amount: number) => void;
    heal: (amount: number) => void;
    setHp: (hp: number) => void;
    restart: () => void;

    cursorHit: THREE.Vector3;
    cursorHitUniform: THREE.UniformNode<THREE.Vector3>;

    horde: HordeBuffers;
    projectiles: ProjectilesBuffers;
    playerData: PlayerData;
};

export const useHordeStore = create<HordeStore>((set) => ({
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

    cursorHit: new THREE.Vector3(),
    cursorHitUniform: uniform(new THREE.Vector3(0, 0, 1)),

    horde: createHordeBuffers(1000),
    projectiles: createPojectilesBuffer(32),
    playerData: createPlayerData(),
}));


//--------------------------------------------------

export function createHordeBuffers(
    count: number,
) {
    return {
        pos_buffer: createFloatBuffer(count, 3),
        vel_buffer: createFloatBuffer(count, 3),
        transformsBuffer: createTransformsBuffer(count),
        nbr_grid: new NeighbourGrid2D(100, 20, 32),
        count: count,
        hp_buffer: storage(
            new THREE.StorageBufferAttribute(count, 1), 'uint', 1
        ).setPBO(true).toAtomic()
    }
}

export type HordeBuffers = ReturnType<typeof createHordeBuffers>;


export function createPojectilesBuffer(
    count: number,
) {
    const transformsBuffer = createTransformsBuffer(count)
    const pos_buffer = createFloatBuffer(count, 3)
    const vel_buffer = createFloatBuffer(count, 3)

    const alive_buffer = createFloatBuffer(count, 1, Uint8Array)
    const age_buffer = createFloatBuffer(count, 1, Float32Array)
    const nbr_grid = new NeighbourGrid2D(100, 20, 32)

    /*const fill_grid_compute = () => {
        return Fn(() => {
            If(instanceIndex.lessThan(pos_buffer.count), () => {
                If(alive_buffer.element.notEqual(0), () => {                    
                    nbr_grid.insertParticle(pos_buffer.element, instanceIndex)
                })
            })
        })().compute(count);
    }*/

    const fill_grid_compute = nbr_grid.fillGrid_PosFlag(pos_buffer.element, count, alive_buffer.element.notEqual(0));


    return {
        transformsBuffer,
        pos_buffer,
        vel_buffer,

        alive_buffer,
        age_buffer,
        nbr_grid,

        count: count,

        utils: {
            initFromPosAndVel: (pos: THREE.Node, vel: THREE.Node) => {
                pos_buffer.element.assign(pos);
                transformsBuffer.utils.toUnitmatrix();
                transformsBuffer.utils.setPosition(pos_buffer.element);
                vel_buffer.element.assign(vel);
                transformsBuffer.utils.orientFromVel(vel_buffer.element);
                age_buffer.element.assign(0.0);
                alive_buffer.element.assign(1.0);
            },
            fill_grid_compute
        }


    }
}

export type ProjectilesBuffers = ReturnType<typeof createPojectilesBuffer>;


// --------------------------------

type PlayerData = {
    player: THREE.Group | null;
    playerWorldPosition: THREE.Vector3;

    tsl_PlayerWorldPosition: THREE.UniformNode<THREE.Vector3>;
    tsl_PlayerVelocity: THREE.UniformNode<THREE.Vector3>;

};

export function createPlayerData(): PlayerData {
    return {
        player: null,
        playerWorldPosition: new THREE.Vector3(),
        tsl_PlayerWorldPosition: uniform(new THREE.Vector3(0, 0, 0)),
        tsl_PlayerVelocity: uniform(new THREE.Vector3(0, 0, 0)),
    }
}
