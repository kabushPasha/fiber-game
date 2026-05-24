import { useCallback, useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { If, instanceIndex, int, storage, uniform, vec4 } from "three/tsl";
import { StorageInstancedBufferAttribute } from "three/webgpu";
import { useTransformsBufferContext, InstancedMeshSimple, InstancedTransformMaterial } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import { usePlayer } from "../../Player/PlayerContext";
import { Fn } from "three/src/nodes/TSL.js";
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";

type CreateRingBufferProps = {
    size: number;
    onSpawn: () => void;
};

export function createRingBuffer({ size, onSpawn }: CreateRingBufferProps) {
    const head = useRef(0);
    const renderer = useWebGPURenderer()

    const uniforms = useMemo(() => ({
        spawn_count: uniform(int(0.0)),
        head: uniform(int(1)),
    }), [])

    const spawnCount = useCallback((spawn_count: number) => {
        head.current = head.current % size;
        uniforms.spawn_count.value = spawn_count;
        uniforms.head.value = head.current;
        renderer.compute(computeUpdate);
        head.current = head.current + spawn_count;

    }, [])

    // Spawn Comput
    const computeUpdate = useMemo(() => {
        return Fn(() => {
            const relative = instanceIndex.sub(uniforms.head).add(size).mod(size);
            If(relative.lessThan(uniforms.spawn_count), () => { onSpawn() }
            )
        })().compute(size);
    }, [uniforms]);

    return { size, spawnCount }
}
export function useTimer(timer_delta: number, callback: () => void) {
    const time_time = useRef(timer_delta);
    useFrame((_, delta) => {
        time_time.current -= delta;
        if (time_time.current < 0) {
            time_time.current += timer_delta;
            callback();
        }
    })
}
export function createFloatBuffer(count: number, item_size: number) {
    const bufferAttribute = useMemo(() => { return new StorageInstancedBufferAttribute(new Float32Array(count * item_size), item_size); }, [count])
    const bufferNode = useMemo(() => storage(bufferAttribute).setPBO(true), [bufferAttribute]);
    const element = useMemo(() => { return bufferNode.element(instanceIndex) }, [bufferNode])

    return {
        bufferAttribute,
        bufferNode,
        element,
        count
    }
}
export function createTransformsBuffer(count: number) {
    const buffer = createFloatBuffer(count, 16);

    const utils = useMemo(() => {
        const toUnitmatrix = () => {
            buffer.element.element(int(0)).assign(vec4(1, 0, 0, 0));
            buffer.element.element(int(1)).assign(vec4(0, 1, 0, 0));
            buffer.element.element(int(2)).assign(vec4(0, 0, 1, 0));
            buffer.element.element(int(3)).assign(vec4(0, 0, 0, 1));
        }

        const setPosition = (pos:THREE.Node) => {
            buffer.element.element(int(3)).assign(vec4(pos, 1));
        }

        return {toUnitmatrix, setPosition};
    }, [])

    return {
        ...buffer,
        transformsBufferNode: buffer.bufferNode,
        instanceMatrix: buffer.element,
        utils,
    }
}
export function createPositionsBuffer(count: number) {
    return createFloatBuffer(count, 3);
}





export function RingBuffer({ children }: PropsWithChildren) {
    const size = 32;
    const transformsBuffer = createTransformsBuffer(size);
    const pos_buffer = createPositionsBuffer(size);
    const player = usePlayer()

    const onSpawn = useCallback(() => {
        pos_buffer.element.assign(player.tsl_PlayerWorldPosition);
        transformsBuffer.utils.toUnitmatrix();
        transformsBuffer.utils.setPosition( pos_buffer.element );        
    }, [])

    const ringBuffer = createRingBuffer({ size, onSpawn });

    // Spawn on E
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code == "KeyE") {
                ringBuffer.spawnCount(1);
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    // Spawn on Time
    useTimer(0.1, () => { ringBuffer.spawnCount(1); });

    return <useTransformsBufferContext.Provider value={transformsBuffer}>
        {children}
    </useTransformsBufferContext.Provider>;
}

export function RingBufferTest() {
    return <RingBuffer>
        <InstancedMeshSimple >
            <boxGeometry />
            <InstancedTransformMaterial />
        </InstancedMeshSimple>
    </RingBuffer>
}