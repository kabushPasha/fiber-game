import React, { createContext, useContext, useMemo, useRef, useEffect, type PropsWithChildren, useLayoutEffect, useState } from "react";

import { instanceIndex, int, normalLocal, positionLocal, rand, storage, transformNormalToView, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial, StorageInstancedBufferAttribute } from "three/webgpu";
import { createInstanceTransforms, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";
import { useThree } from "@react-three/fiber";


interface MeshDataEntry {
    offset: number; // start index in the packed array
    count: number;  // number of instances for this mesh
    instanceMatrix: any; // TSL node for transforms
}

// --- Context ---
interface TransformsContextType {
    count: number;
    instanceTransforms: Float32Array;
    transformsBuffer: ReturnType<typeof storage>;
    transformsAtt: StorageInstancedBufferAttribute;
    meshData: Record<number, MeshDataEntry>;
}

const TransformsContext = createContext<TransformsContextType | undefined>(undefined);

export const useTransforms = () => {
    const context = useContext(TransformsContext);
    if (!context) throw new Error("useTransforms must be used within a TransformsProvider");
    return context;
};

// --- Provider Component ---
type TransformsProviderProps = React.PropsWithChildren<TerrainScatterProps>;

export function TransformsProvider({ children, ...props }: TransformsProviderProps) {
    const { gridSize, spacing, rotation_random, scale, scale_random, offset_random } = useTerrainScatterControls(props);
    const count = useMemo(() => gridSize * gridSize, [gridSize]);

    const instanceTransforms = useMemo(() =>
        createInstanceTransforms({ gridSize, spacing, scale, scale_random, rotation_random, offset_random })
        , [gridSize, spacing, scale, scale_random, rotation_random, offset_random]);

    const transformsAtt = useMemo(() => new StorageInstancedBufferAttribute(instanceTransforms, 16), [count]);
    const transformsBuffer = useMemo(() => storage(transformsAtt).setPBO(true), [transformsAtt]);

    //    Create Mesh Ids
    const ids = useMemo(() => {
        console.log("Update IDS")
        const ids = new Int16Array(count)
        for (let x = 0; x < count; x++) {
            ids[x] = x % 2;
        }
        console.log(ids);
        return ids;
    }, [count])

    // Calculate Mesh ID OFfsets
    const MeshIdCountsOffset = useMemo(() => {
        const counts: Record<number, number> = {};
        // Count occurrences
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            counts[id] = (counts[id] || 0) + 1;
        }
        // Convert to offsets
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

    const packedIndices = useMemo(() => {
        const array = new Int32Array(ids.length);
        // copy offsets so we can increment while filling
        const writeOffsets: Record<number, number> = {};
        for (const key in MeshIdCountsOffset) {
            writeOffsets[key] = MeshIdCountsOffset[key].offset;
        }
        // Fill
        for (let i = 0; i < ids.length; i++) {
            const meshId = ids[i];
            const writeIndex = writeOffsets[meshId]++;
            array[writeIndex] = i;
        }
        return array;
    }, [ids, MeshIdCountsOffset]);

    const indexAttribute = useMemo(() => {
        return new StorageInstancedBufferAttribute(packedIndices, 1);
    }, [packedIndices]);

    const indexBuffer = useMemo(() => {
        return storage(indexAttribute, 'uint').setPBO(true);
    }, [indexAttribute]);

    const meshData = useMemo(() => {
        const result: Record<number, {
            offset: number;
            count: number;
            instanceMatrix: any;
        }> = {};

        for (const key in MeshIdCountsOffset) {
            const meshId = Number(key);
            const { offset, count } = MeshIdCountsOffset[meshId];

            const index = int(
                indexBuffer.element(instanceIndex.add(int(offset)))
            );

            result[meshId] = {
                offset,
                count,
                instanceMatrix: transformsBuffer.element(index)
            };
        }

        console.log(result);
        return result;
    }, [MeshIdCountsOffset, indexBuffer, transformsBuffer]);


    // Sync updates if instanceTransforms changes
    useEffect(() => {
        transformsAtt.array.set(instanceTransforms);
        transformsAtt.needsUpdate = true;
    }, [instanceTransforms, transformsAtt]);

    return (
        <TransformsContext.Provider value={{ count, instanceTransforms, transformsBuffer, transformsAtt, meshData }}>
            {children}
        </TransformsContext.Provider>
    );
}





