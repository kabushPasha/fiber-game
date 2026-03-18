import React, { createContext, useContext, useMemo, useRef, useEffect, type PropsWithChildren, useLayoutEffect, useState } from "react";
import * as THREE from "three/webgpu";
import { instanceIndex, int, normalLocal, positionLocal, rand, storage, transformNormalToView, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial, StorageInstancedBufferAttribute } from "three/webgpu";
import { createInstanceTransforms, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";
import { useThree } from "@react-three/fiber";

// --- Context ---
interface TransformsContextType {
    count: number;
    instanceTransforms: Float32Array;
    transformsBuffer: ReturnType<typeof storage>;
    transformsAtt: StorageInstancedBufferAttribute;
    meshData: Record<number, { ids: number[]; buffer: ReturnType<typeof storage> }>
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

    const ids = useMemo(() => {
        console.log("Update IDS")
        const ids = new Int16Array(count)
        for (let x = 0; x < count; x++) {
            ids[x] = x % 2;
        }
        console.log(ids);
        return ids;
    }, [count])

    const meshData = useMemo(() => {
        console.log("Update MeshData")
        const meshDict: Record<number, { ids: number[]; buffer: ReturnType<typeof storage> }> = {};

        // Group instance IDs by mesh index
        for (let i = 0; i < ids.length; i++) {
            const meshId = ids[i];
            if (!meshDict[meshId]) {
                meshDict[meshId] = { ids: [], buffer: null as any };
            }
            meshDict[meshId].ids.push(i);
        }

        // Create GPU buffer for each mesh
        for (const meshIdStr of Object.keys(meshDict)) {
            const meshId = Number(meshIdStr);
            const indices = meshDict[meshId].ids;
            const gpuArray = new StorageInstancedBufferAttribute(new Int16Array(indices), 1)
            meshDict[meshId].buffer = storage(gpuArray, 'uint').setPBO(true);
        }

        return meshDict;
    }, [ids]);

    const instanceTransforms = useMemo(() =>
        createInstanceTransforms({ gridSize, spacing, scale, scale_random, rotation_random, offset_random })
        , [gridSize, spacing, scale, scale_random, rotation_random, offset_random]);

    const transformsAtt = useMemo(() => new StorageInstancedBufferAttribute(instanceTransforms, 16), [count]);

    const transformsBuffer = useMemo(() => storage(transformsAtt).setPBO(true), [transformsAtt]);

    // Sync updates if instanceTransforms changes
    useEffect(() => {
        console.log("Update Tranfomrs")
        transformsAtt.array.set(instanceTransforms);
        transformsAtt.needsUpdate = true;
    }, [instanceTransforms, transformsAtt]);

    return (
        <TransformsContext.Provider value={{ count, instanceTransforms, transformsBuffer, transformsAtt, meshData }}>
            {children}
        </TransformsContext.Provider>
    );
}

type InstanceMultiMeshProps = React.PropsWithChildren<{
    mesh_id?: number,
}>



// --- InstanceMesh using Context ---
export function InstanceMultiMesh({ mesh_id = 0, children }: InstanceMultiMeshProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const { transformsBuffer, meshData, transformsAtt } = useTransforms();

    const count = useMemo(() => {
        console.log(meshData[mesh_id]);
        console.log("Update MESH Count")
        return meshData[mesh_id].ids.length;
    }, [meshData, mesh_id])

    const instanceMatrix = useMemo(() => {
        console.log("Update Instance Matrix")
        const index = int(meshData[mesh_id].buffer.element(instanceIndex))
        return transformsBuffer.element(index)
    }, [transformsBuffer])

    const compute_mat = useMemo(() => {
        console.log("Update MESH Mat")
        const mat = new MeshStandardNodeMaterial();
        mat.positionNode = instanceMatrix.mul(positionLocal);
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);

        return mat;
    }, [ instanceMatrix]);

    const geometry = useMemo(() => {
        const g = new THREE.BoxGeometry(1, 1, 1);
        g.translate(0, 0.5, 0);
        return g;
    }, []);


    return <instancedMesh ref={meshRef} args={[geometry, compute_mat, count]} position={[0, 5, 0]} >
        {children}
    </instancedMesh>;
}


