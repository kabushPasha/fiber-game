import React, { createContext, useContext, useMemo, useEffect, type PropsWithChildren } from "react";
import { int, instanceIndex, storage, mat4 } from "three/tsl";
import { StorageInstancedBufferAttribute } from "three/webgpu";
import { useTransforms } from "./TransformsProvider"; // assume same folder
import * as THREE from "three/webgpu";

// --- MeshRandomizer Context ---
export interface MeshDataEntry {
    offset: number;
    count: number;
    instanceMatrix: THREE.Node;
}

interface MeshRandomizerContextType {
    meshData: Record<number, MeshDataEntry>;
}

export const MeshRandomizerContext = createContext<MeshRandomizerContextType | undefined>(undefined);


export function useMeshRandomizer(mesh_id: number = 0): MeshDataEntry {
    const randomizerContext = useContext(MeshRandomizerContext);
    if (randomizerContext) {
        const data = randomizerContext.meshData[mesh_id];
        if (!data) {
            console.log(`MeshRandomizer: mesh_id ${mesh_id} not found in meshData`);
            return {
                count: 0,
                instanceMatrix: mat4(),
                offset: 0
            }

        }
        return {
            count: data.count,
            instanceMatrix: data.instanceMatrix,
            offset: data.offset
        };
    }

    // Fallback to TransformsProvider
    const { count,instanceMatrix } = useTransforms();

    return {
        count,
        instanceMatrix, 
        offset: 0
    };
}

// --- Provider Component ---
export const MeshRandomizerProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const { count, transformsBuffer } = useTransforms();

    // --- Generate IDs ---
    const ids = useMemo(() => {
        const array = new Int16Array(count);
        for (let i = 0; i < count; i++) array[i] = i % 2; // Example randomization
        return array;
    }, [count]);

    // --- Compute Mesh Offsets ---
    const MeshIdCountsOffset = useMemo(() => {
        const counts: Record<number, number> = {};
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            counts[id] = (counts[id] || 0) + 1;
        }

        const meta: Record<number, { offset: number; count: number }> = {};
        let offset = 0;
        for (const key of Object.keys(counts)) {
            const meshId = Number(key);
            const count = counts[meshId];
            meta[meshId] = { offset, count };
            offset += count;
        }
        return meta;
    }, [ids]);

    // --- Pack Indices ---
    const packedIndices = useMemo(() => {
        const array = new Int32Array(ids.length);
        const writeOffsets: Record<number, number> = {};
        for (const key in MeshIdCountsOffset) writeOffsets[key] = MeshIdCountsOffset[key].offset;

        for (let i = 0; i < ids.length; i++) {
            const meshId = ids[i];
            array[writeOffsets[meshId]++] = i;
        }

        return array;
    }, [ids, MeshIdCountsOffset]);

    const indexAttribute = useMemo(() => new StorageInstancedBufferAttribute(packedIndices, 1), [packedIndices]);
    const indexBuffer = useMemo(() => storage(indexAttribute, "uint").setPBO(true), [indexAttribute]);

    // --- Build Mesh Data ---
    const meshData = useMemo(() => {
        const result: Record<number, MeshDataEntry> = {};

        for (const key in MeshIdCountsOffset) {
            const meshId = Number(key);
            const { offset, count } = MeshIdCountsOffset[meshId];
            const index = int(indexBuffer.element(instanceIndex.add(int(offset))));

            result[meshId] = {
                offset,
                count,
                instanceMatrix: transformsBuffer.element(index)
            };
        }

        return result;
    }, [MeshIdCountsOffset, indexBuffer, transformsBuffer]);

    return (
        <MeshRandomizerContext.Provider value={{ meshData }}>
            {children}
        </MeshRandomizerContext.Provider>
    );
};