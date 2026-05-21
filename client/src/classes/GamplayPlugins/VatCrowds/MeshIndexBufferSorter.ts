import { Fn } from "three/src/nodes/TSL.js";
import { atomicAdd, atomicStore, If, instanceIndex, storage } from "three/tsl";
import { StorageBufferAttribute } from "three/webgpu";
import * as THREE from "three/webgpu"



// Class that create Mesh_Id buffer and then calculates sorted indexes for it

/*
    // HOW TO USE
    const renderer = useWebGPURenderer();

    const index_buffer = useMemo( () => new IndexBuffer(10,10), []);

    useEffect(() => {
        renderer.computeAsync(index_buffer.compute_setMeshIndecies(1,4,3))
        renderer.compute(index_buffer.compute_ClearMeshCounts())
        renderer.compute(index_buffer.compute_MeshCount())
        index_buffer.compute_MeshOffset(renderer);
        renderer.compute(index_buffer.compute_ScatterIndices())
    }, [index_buffer])
*/


export class IndexBuffer {
    count: number
    maxMeshCount: number

    meshIndexBuffer

    meshCounts: Uint32Array
    meshOffsets: Uint32Array

    meshCountsBuffer
    meshOffsetsBuffer
    meshCursorBuffer
    packedIndicesBuffer

    constructor(count: number, maxMeshCount: number) {
        this.count = count;
        this.maxMeshCount = maxMeshCount;

        // Initialize Buffers
        // Mesh Indexes
        const indexes = new Uint32Array(this.count);
        this.meshIndexBuffer = storage(
            new StorageBufferAttribute(indexes, 1), 'uint', 1
        ).setPBO(true)

        // Mesh Counts
        this.meshCounts = new Uint32Array(maxMeshCount);
        this.meshCounts[0] = maxMeshCount;
        this.meshCountsBuffer = storage(
            new StorageBufferAttribute(this.meshCounts, 1),
            'uint',
            1
        ).setPBO(true).toAtomic();

        // Mesh Offsets
        this.meshOffsets = new Uint32Array(maxMeshCount);
        this.meshOffsetsBuffer = storage(
            new StorageBufferAttribute(this.meshOffsets, 1),
            'uint',
            1
        ).setPBO(true);

        // WRITE CURSORS
        // copy of offsets used during scatter
        const meshCursor = new Uint32Array(maxMeshCount);
        this.meshCursorBuffer = storage(
            new StorageBufferAttribute(meshCursor, 1),
            'uint',
            1
        ).setPBO(true).toAtomic();

        // FINAL PACKED INDICES
        const packedIndices = new Uint32Array(count);
        this.packedIndicesBuffer = storage(
            new StorageBufferAttribute(packedIndices, 1),
            'uint',
            1
        ).setPBO(true);


    }

    compute_ClearMeshCounts() {
        return Fn(() => {
            If(instanceIndex.lessThan(this.maxMeshCount), () => {
                atomicStore(this.meshCountsBuffer.element(instanceIndex), 0);
            });
        })().compute(this.maxMeshCount);
    }

    compute_MeshCount() {
        return Fn(() => {
            If(instanceIndex.lessThan(this.count), () => {
                const meshId = this.meshIndexBuffer.element(instanceIndex);
                atomicAdd(this.meshCountsBuffer.element(meshId), 1);
            })
        })().compute(this.count)
    }

    async compute_MeshOffset(renderer: THREE.WebGPURenderer) {
        const buffer = await renderer.getArrayBufferAsync(this.meshCountsBuffer.value);
        this.meshCounts.set(new Uint32Array(buffer));
        // compute Mesh offset        
        let offset = 0;
        for (let i = 0; i < this.maxMeshCount; i++) {
            this.meshOffsets[i] = offset;
            offset += this.meshCounts[i];
        }
        // push to GPU        
        this.meshOffsetsBuffer.value.array.set(this.meshOffsets);
        this.meshOffsetsBuffer.value.needsUpdate = true;
        this.meshCursorBuffer.value.array.set(this.meshOffsets);
        this.meshCursorBuffer.value.needsUpdate = true;
        console.log("counts", this.meshCounts, "offsets", this.meshOffsets);
    }

    compute_setMeshIndecies(index: number, range_start: number, count: number) {
        return Fn(() => {
            If(instanceIndex.lessThan(count), () => {
                this.meshIndexBuffer.element(instanceIndex.add(range_start)).assign(index);
            })
        })().compute(count)
    }

    compute_ScatterIndices() {
        return Fn(() => {
            If(instanceIndex.lessThan(this.count), () => {
                const meshId = this.meshIndexBuffer.element(instanceIndex);
                const dst = atomicAdd(this.meshCursorBuffer.element(meshId), 1);
                this.packedIndicesBuffer.element(dst).assign(instanceIndex);
            });
        })().compute(this.count);
    }




}