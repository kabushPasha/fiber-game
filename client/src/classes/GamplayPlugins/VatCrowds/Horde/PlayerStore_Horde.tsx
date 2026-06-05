import { create } from "zustand";
import * as THREE from "three/webgpu";
import { uniform } from "three/tsl";
import { NeighbourGrid2D } from "../../../Terrain/ECS/NbrGrid2D";

type PlayerStore = {
    hp: number;
    run: number;
    damage: (amount: number) => void;
    heal: (amount: number) => void;
    setHp: (hp: number) => void;
    restart: () => void;

    cursorHit: THREE.Vector3;
    cursorHitUniform: THREE.UniformNode<THREE.Vector3>;

    horde_nbr_grid: NeighbourGrid2D;
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

    cursorHit: new THREE.Vector3(),
    cursorHitUniform: uniform(new THREE.Vector3(0, 0, 1)),

    horde_nbr_grid: new NeighbourGrid2D(100, 20, 32)
}));