import { useCallback, useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { deltaTime, If, instanceIndex, int, storage, uniform, vec3, vec4 } from "three/tsl";
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

type BufferArrayConstructor =
    | Float32ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int8ArrayConstructor
    | Uint8ArrayConstructor;

export function createFloatBuffer(
  count: number,
  item_size: number,
  ArrayType: BufferArrayConstructor = Float32Array
) {
  const bufferAttribute = new StorageInstancedBufferAttribute(
    new ArrayType(count * item_size),
    item_size
  );

  const bufferNode = storage(bufferAttribute).setPBO(true);
  const element = bufferNode.element(instanceIndex);

  const reset = () => {
    bufferAttribute.array.fill(0);
    bufferAttribute.needsUpdate = true;
  };

  return {
    count,
    bufferAttribute,
    bufferNode,
    element,
    reset,
  };
}

export function createFloatBufferMemo(
  count: number,
  item_size: number,
  ArrayType: BufferArrayConstructor = Float32Array
) {
  return useMemo(
    () => createFloatBuffer(count, item_size, ArrayType),
    [count, item_size, ArrayType]
  );
}

export type FloatBuffer = ReturnType<typeof createFloatBufferMemo>;

export function createTransformsBuffer(count: number) {
  const buffer = createFloatBuffer(count, 16);

  const toUnitmatrix = (scale = 1) => {
    buffer.element.element(int(0)).assign(vec4(scale, 0, 0, 0));
    buffer.element.element(int(1)).assign(vec4(0, scale, 0, 0));
    buffer.element.element(int(2)).assign(vec4(0, 0, scale, 0));
    buffer.element.element(int(3)).assign(vec4(0, 0, 0, scale));
  };

  const setPosition = (pos: THREE.Node) => {
    buffer.element.element(int(3)).assign(vec4(pos, 1));
  };

  const orientFromVel = (vel: THREE.Node) => {
    const forward = vel.normalize();
    const up = vec3(0, 1, 0);
    const right = up.cross(forward).normalize();

    const rightCol = buffer.element.element(int(0));
    const upCol = buffer.element.element(int(1));
    const forwardCol = buffer.element.element(int(2));

    const scaleX = rightCol.length();
    const scaleY = upCol.length();
    const scaleZ = forwardCol.length();

    buffer.element.element(int(0)).assign(vec4(right, 0).mul(scaleX));
    buffer.element.element(int(1)).assign(vec4(up, 0).mul(scaleY));
    buffer.element.element(int(2)).assign(vec4(forward, 0).mul(scaleZ));
  };

  return {
    ...buffer,
    transformsBufferNode: buffer.bufferNode,
    instanceMatrix: buffer.element,
    utils: {
      toUnitmatrix,
      setPosition,
      orientFromVel,
    },
  };
}

export function createTransformsBufferMemo(count: number) {
  return useMemo(() => createTransformsBuffer(count), [count]);
}

export function createPositionsBuffer(count: number) {
    return createFloatBufferMemo(count, 3);
}
export function createVelocityBuffer(count: number) {
    // Move Pos By VEL?
    // DRAG ??    

    return createFloatBufferMemo(count, 3);
}
// Implementations
export function RingBuffer({ children }: PropsWithChildren) {
    const size = 32;
    const transformsBuffer = createTransformsBufferMemo(size);
    const pos_buffer = createPositionsBuffer(size);
    const vel_buffer = createVelocityBuffer(size);
    const player = usePlayer()
    const renderer = useWebGPURenderer();

    const onSpawn = useCallback(() => {
        pos_buffer.element.assign(player.tsl_PlayerWorldPosition);
        transformsBuffer.utils.toUnitmatrix();
        transformsBuffer.utils.setPosition(pos_buffer.element);
        vel_buffer.element.assign(player.tsl_PlayerVelocity.negate());
    }, [])

    const ringBuffer = createRingBuffer({ size, onSpawn });

    // Spawn on E
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.code == "KeyE") { ringBuffer.spawnCount(1); } }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    // Spawn on Timew
    useTimer(0.1, () => { ringBuffer.spawnCount(1); });

    //move by vel
    const computeUpdate = useCallback(() => {
        const fn = Fn(() => {
            // Move POS by VEL
            pos_buffer.element.addAssign(vel_buffer.element.mul(deltaTime));
            // DRAG VEL
            vel_buffer.element.mulAssign(0.99);
            // move pos to transforms buffer
            transformsBuffer.utils.setPosition(pos_buffer.element);
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



export function RingBufferTest() {
    return <RingBuffer />
}









/*

// Index Buffer Context -------------------------------------------------
export interface IndexBufferContextType { index_buffer: IndexBuffer, }
export const useIndexBufferContext = createContext<IndexBufferContextType | undefined>(undefined);
export function useIndexBuffer(): IndexBufferContextType {
    const ctx = useContext(useIndexBufferContext);
    if (!ctx) { throw new Error("useProject must be used within ProjectProvider"); }
    return ctx;
}
export function createIndexBuffer(count: number, max_index: number) {
    const renderer = useWebGPURenderer();
    const index_buffer = useMemo(() => new IndexBuffer(count, max_index), []);

    const computeIndexOffsets = useCallback(() => {
        //renderer.computeAsync(index_buffer.compute_setMeshIndecies(1, 4, 3))
        renderer.compute(index_buffer.compute_ClearMeshCounts())
        renderer.compute(index_buffer.compute_MeshCount())
        index_buffer.compute_MeshOffset(renderer);
        renderer.compute(index_buffer.compute_ScatterIndices())
    }, [index_buffer])

    return { index_buffer, computeIndexOffsets };
}
// Instanced Mesh Simple
type InstancedMeshIndexedProps = PropsWithChildren<{
    mesh_index?: number;
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material;
}>;

export function InstancedMeshIndexed({ children, geometry, material, mesh_index }: InstancedMeshIndexedProps) {
    const indexed_mesh = useIndexBuffer();
    const [count, setCount] = useState(0);

    useFrame(() => {
        setCount(indexed_mesh.index_buffer.meshCounts[mesh_index ?? 1]);
    });

    return <instancedMesh
        args={[geometry, material, count]}
        position={[0, 0, 0]}
        frustumCulled={false}
    >
        {children}
    </instancedMesh>;
}

export function IndexedInstancedTransformMaterial({ mesh_index }: { mesh_index: number }) {
    const { transformsBufferNode } = useTransformsBuffer();
    const { index_buffer } = useIndexBuffer();

    const instanceMatrix = useMemo(() => {
        //return transformsBufferNode.element(instanceIndex);
        const meshOffset = index_buffer.meshOffsetsBuffer.element(mesh_index);

        const packedIndex =
            index_buffer.packedIndicesBuffer.element(
                meshOffset.add(instanceIndex)
            );

        return transformsBufferNode.element(packedIndex);

    }, [transformsBufferNode, mesh_index])

    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.positionNode = instanceMatrix.mul(positionLocal);
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);
        return mat;
    }, [instanceMatrix]);

    return <primitive object={material} attach="material" />
}

*/








/*
export function IndexedBuffer({ children }: PropsWithChildren) {
    const size = 200;
    const transformsBuffer = createTransformsBuffer(size);
    const pos_buffer = createPositionsBuffer(size);
    const vel_buffer = createVelocityBuffer(size);
    const player = usePlayer()
    const renderer = useWebGPURenderer();

    const indexBuffer = createIndexBuffer(size, 4);

    const onSpawn = useCallback(() => {
        pos_buffer.element.assign(player.tsl_PlayerWorldPosition);
        transformsBuffer.utils.toUnitmatrix();
        transformsBuffer.utils.setPosition(pos_buffer.element);
        // assign random index
        indexBuffer.index_buffer.meshIndexBuffer.element(instanceIndex).assign(instanceIndex.mod(2).add(1));
        vel_buffer.element.assign(player.tsl_PlayerVelocity.negate());
    }, [])

    const ringBuffer = createRingBuffer({ size, onSpawn });

    // Spawn on E
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code == "KeyE") {
                ringBuffer.spawnCount(1);
                indexBuffer.computeIndexOffsets();
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    // Spawn on Timew
    
    useTimer(0.1, () => {
        ringBuffer.spawnCount(1);
        indexBuffer.computeIndexOffsets();
    });

    
    useFrame(() => {
        indexBuffer.computeIndexOffsets();
    })
        

    //move by vel
    const computeUpdate = useCallback(() => {
        const fn = Fn(() => {
            // Move POS by VEL
            pos_buffer.element.addAssign(vel_buffer.element.mul(deltaTime));
            // DRAG VEL
            vel_buffer.element.mulAssign(0.99);
            // move pos to transforms buffer
            transformsBuffer.utils.setPosition(pos_buffer.element);
        });
        return renderer.compute(fn().compute(size))
    }, [pos_buffer, vel_buffer, size, renderer])

    useFrame((_, delta) => {
        computeUpdate();
        //indexBuffer.computeIndexOffsets();
    })



    return <useTransformsBufferContext.Provider value={transformsBuffer}>
        {children}

        {false && <InstancedMeshSimple >
            <boxGeometry />
            <InstancedTransformMaterial />
        </InstancedMeshSimple>}

        <useIndexBufferContext.Provider value={indexBuffer} >
            <InstancedMeshIndexed mesh_index={1}>
                <IndexedInstancedTransformMaterial mesh_index={1} />
                <sphereGeometry />
            </InstancedMeshIndexed>

            <InstancedMeshIndexed mesh_index={2}>
                <IndexedInstancedTransformMaterial mesh_index={2} />
                <coneGeometry />
            </InstancedMeshIndexed>

            <InstancedMeshIndexed mesh_index={0}>
                <IndexedInstancedTransformMaterial mesh_index={0} />
                <boxGeometry />
            </InstancedMeshIndexed>


        </useIndexBufferContext.Provider>


    </useTransformsBufferContext.Provider>;
}
*/
