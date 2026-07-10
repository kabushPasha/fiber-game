import { Sphere } from "@react-three/drei";
import { BallCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import * as THREE from "three/webgpu";


export class Collectible {
    position: THREE.Vector3;
    type: string;
    collected: boolean;

    constructor(
        position: THREE.Vector3,
        type: string,
    ) {
        this.position = position;
        this.type = type;
        this.collected = false;
    }

    collect() {
        if (this.collected) return;
        this.collected = true;
        const audio = new Audio("sfx/Pap.mp3");
        audio.volume = 1.0;
        audio.play();
    }

    reset() {
        this.collected = false;
    }
}

type GameState = {
    collectibles: Collectible[];

    addCollectible: (collectible: Collectible) => void;
    removeCollectible: (collectible: Collectible) => void;

    getNearestCollectible: (
        position: THREE.Vector3
    ) => Collectible | undefined;

    reset: () => void;
};

export const useCollectiblesStore = create<GameState>((set, get) => ({
    collectibles: [],

    addCollectible: (collectible) =>
        set((state) => ({
            collectibles: [
                ...state.collectibles,
                collectible,
            ],
        })),

    removeCollectible: (collectible) =>
        set((state) => ({
            collectibles: state.collectibles.filter(
                (c) => c !== collectible
            ),
        })),

    getNearestCollectible: (position) => {
        const available = get()
            .collectibles
            .filter((c) => !c.collected);

        if (!available.length) return undefined;

        return available.reduce((nearest, current) => {
            const distance = (a: THREE.Vector3) =>
                a.distanceToSquared(position);

            return distance(current.position) <
                distance(nearest.position)
                ? current
                : nearest;
        });
    },

    reset: () =>
        set((state) => {
            state.collectibles.forEach((c) => c.reset());

            return {
                collectibles: [...state.collectibles],
            };
        }),
}));


type CollectibleProps = {
    position: THREE.Vector3 | [number, number, number];
    type: string;
};

export function Collectible3D({
    position,
    type,
}: CollectibleProps) {
    const addCollectible = useCollectiblesStore((s) => s.addCollectible);
    const removeCollectible = useCollectiblesStore((s) => s.removeCollectible);

    const vectorPosition = useMemo(
        () => position instanceof THREE.Vector3
            ? position
            : new THREE.Vector3(...position),
        [position]
    );

    const collectible = useMemo(
        () => new Collectible(vectorPosition, type),
        [vectorPosition, type]
    );

    useEffect(() => {
        addCollectible(collectible);
        return () => { removeCollectible(collectible); };
    }, [collectible, addCollectible, removeCollectible]);

    const [collected, setCollected] = useState(false);

    if (collected) return null;

    return (
        <RigidBody type="fixed" position={vectorPosition} colliders={false}>
            <BallCollider
                args={[2]}
                sensor
                onIntersectionEnter={() => {
                    collectible.collect();
                    setCollected(true);
                }}
            />
            <Sphere />
        </RigidBody>
    );
}