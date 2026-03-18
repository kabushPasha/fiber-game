import React, { createContext, useContext, useState, useCallback, useEffect, type PropsWithChildren, useMemo, useRef } from "react";
import { createInstanceTransforms, LoadGltfGeo, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";
import { Node, StorageInstancedBufferAttribute } from "three/webgpu";
import { instanceIndex, int, normalLocal, positionLocal, storage, transformNormalToView, vec4 } from "three/tsl";
import * as THREE from "three/webgpu";
import { MeshRandomizerContext, type MeshDataEntry } from "./MeshRandomizerProvider";
import { InstanceMultiMesh } from "./InstanceMultiMesh";

// ---- CONTEXT ---------------------------------

type ValuesMap<T> = Record<string, T>;

interface DynamicContextType<T> {
    values: ValuesMap<T>;
    register: (value: T) => string; // returns generated ID
    unregister: (id: string) => void;
}

const DynamicContext = createContext<DynamicContextType<any> | undefined>(undefined);

export function useDynamicContext<T>() {
    const ctx = useContext<DynamicContextType<T> | undefined>(DynamicContext);
    if (!ctx) throw new Error("useDynamicContext must be used within a DynamicProvider");
    return ctx;
}

// ---- Provider -----------------------------------

interface DynamicProviderProps<T> {
    children: React.ReactNode;
}

export function DynamicProvider<T>({ children }: DynamicProviderProps<T>) {
    const [values, setValues] = useState<ValuesMap<T>>({});

    const register = useCallback((value: T) => {
        console.log("Register New Values")
        const id = crypto.randomUUID(); // automatically generate unique ID
        setValues((prev) => ({ ...prev, [id]: value }));
        return id;
    }, []);

    const unregister = useCallback((id: string) => {
        setValues((prev) => {
            const newValues = { ...prev };
            delete newValues[id];
            return newValues;
        });
    }, []);

    return (
        <DynamicContext.Provider value={{ values, register, unregister }}>
            {children}
        </DynamicContext.Provider>
    );
}



// ------ Child Componenet ------------------------------
export function ChildComponent({ value }: { value: string }) {
    const { register, unregister } = useDynamicContext<string>();
    const [id] = useState(() => register(value));

    useEffect(() => {
        return () => {
            unregister(id);
        };
    }, [id, unregister]);

    return <div>Registered ID: {id}</div>;
}




// NEW TRANSFORMS PROVIDER ------------------------

// Provider --------------------------------
export function InstanceTransformsProvider({ children }: PropsWithChildren) {
    return <DynamicProvider<Float32Array>>
        {children}
    </DynamicProvider>
}

// Grid Scatter -----------------------------------------------------
export function GridScatter(_props: PropsWithChildren<TerrainScatterProps>) {
    const { children, ...props } = _props;
    const { register, unregister } = useDynamicContext<Float32Array>();
    const { gridSize, spacing, scale, scale_random, rotation_random, offset_random } = useTerrainScatterControls(props);

    const localTransforms = useMemo(() => {
        return createInstanceTransforms({ gridSize, spacing, scale, scale_random, rotation_random, offset_random });
    }, [gridSize, spacing, scale, scale_random, rotation_random, offset_random]);

    const [id, setId] = useState<string | null>(null);

    useEffect(() => {        
        const newId = register(localTransforms);
        setId(newId);
        return () => { unregister(newId); };
    }, [localTransforms, register, unregister]);

    return <SliceFromId id={id}>{children}</SliceFromId>;
}

interface SliceFromIdProps {
    id: string | null;
}

export function SliceFromId({ id, children }: PropsWithChildren<SliceFromIdProps>) {
    const offsetTable = useOffsetTable();
    const { transformsBuffer } = useInstancedMeshSlice();

    const fallback = { offset: 0, count: 0 };

    const slice = offsetTable[id];

    const { offset, count } = slice ?? fallback;


    const sliceValue = useMemo(() => ({
        transformsBuffer,
        count,
        offset
    }), [transformsBuffer, count, offset]);

    return (
        <InstancedMeshSliceContext.Provider value={sliceValue}>
            {children}
        </InstancedMeshSliceContext.Provider>
    );
}


// Instance Slice Context -----------------------------------------------------
interface InstancedMeshSlice {
    transformsBuffer: THREE.StorageBufferNode;
    count: number;
    offset: number;
}

const InstancedMeshSliceContext = createContext<InstancedMeshSlice | undefined>(undefined);

export function useInstancedMeshSlice() {
    const ctx = useContext(InstancedMeshSliceContext);
    if (!ctx) throw new Error("useInstancedMeshSlice must be used inside InstancedMeshSliceProvider");
    return ctx;
}

// Offsets Table Context -------------------------------------------
interface OffsetTableEntry {
    count: number;
    offset: number;
}
type OffsetTable = Record<string, OffsetTableEntry>; // keys are integer IDs
const OffsetTableContext = createContext<OffsetTable | undefined>(undefined);
export function useOffsetTable() {
    const ctx = useContext(OffsetTableContext);
    if (!ctx) throw new Error("useOffsetTable must be used inside an OffsetTableProvider");
    return ctx;
}


export function InstanceTransformsBufferGather({ children }: PropsWithChildren) {
    const { values } = useDynamicContext<Float32Array>(); // values: Record<string, Float32Array>
    const [instanceTransforms, setInstanceTransforms] = useState<Float32Array>(new Float32Array());
    const [offsetTable, setOffsetTable] = useState<OffsetTable>({});

    const countsSignature = useMemo(() => {
        return Object.entries(values)
            .map(([id, arr]) => `${id}:${arr.length}`)
            .sort() // ensure stable order
            .join("|");
    }, [values]);


    // Update instance Transforms, and offsets with Counts
    useEffect(() => {
        console.log("Update Instance Transforms")
        const entries = Object.entries(values)
            .sort(([a], [b]) => Number(a) - Number(b)); // sort by numeric ID

        // Calculate total length
        const totalLength = entries.reduce((sum, [, arr]) => sum + arr.length, 0);
        const combined = new Float32Array(totalLength);
        const newOffsets: Record<string, { count: number; offset: number }> = {};

        let offset = 0;
        for (const [id, arr] of entries) {
            newOffsets[id] = { count: arr.length / 16, offset: offset / 16 };
            // dividing by 16 assuming each transform is a 4x4 matrix (16 floats)
            combined.set(arr, offset);
            offset += arr.length;
        }

        setInstanceTransforms(combined);
        //setOffsetTable(newOffsets);
        // --- simple shallow compare before setting ---
        setOffsetTable(prev => {
            const prevKeys = Object.keys(prev);
            const newKeys = Object.keys(newOffsets);
            console.log(prev,newOffsets)

            if (prevKeys.length !== newKeys.length) return newOffsets;

            for (const key of newKeys) {
                const p = prev[key];
                const n = newOffsets[key];
                if (!p || p.count !== n.count || p.offset !== n.offset) {
                    return newOffsets; // changed → update
                }
            }
            console.log("same offsets")
            return prev; // no change → skip update
        });

        console.log("Updated instance transforms and offsets", newOffsets);
    }, [values]);

    // --- Buffer & Attribute ---
    const count = useMemo(() => { return instanceTransforms.length / 16 }, [instanceTransforms])
    const transformsAtt = useMemo(() => new StorageInstancedBufferAttribute(instanceTransforms, 16), [count]);
    const transformsBuffer = useMemo(() => storage(transformsAtt).setPBO(true), [transformsAtt]);

    useEffect(() => {
        transformsAtt.array.set(instanceTransforms);
        transformsAtt.needsUpdate = true;
    }, [instanceTransforms]);


    useEffect(() => {
        console.log("provider transformsBuffer")
    }, [transformsBuffer]);

    useEffect(() => {
        console.log("provider count")
    }, [count]);

    const sliceValue = useMemo(() => ({
        transformsBuffer,
        count,
        offset: 0
    }), [transformsBuffer, count]);


    useEffect(() => {
        console.log("provider offsetsTable", offsetTable)
    }, [offsetTable]);

    useEffect(() => {
        console.log("provider SliceValue")
    }, [sliceValue]);

    return (
        <OffsetTableContext.Provider value={offsetTable}>
            <InstancedMeshSliceContext.Provider value={sliceValue}>
                {children}
            </InstancedMeshSliceContext.Provider>
        </OffsetTableContext.Provider>
    );
}

// --- InstanceMesh using Context ---
export function InstancedSliceMesh({ children }: PropsWithChildren) {
    useEffect(() => {
        console.log("InstancedSliceMesh Mount")
        return () => { console.log("InstancedSliceMesh Unmount") }
    }, [])


    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const { count, transformsBuffer, offset } = useInstancedMeshSlice();

    const instanceMatrix = useMemo(() => {
        return transformsBuffer.element(instanceIndex.add(int(offset)))
    }, [transformsBuffer, offset])

    const compute_mat = useMemo(() => {
        //console.log("Update MESH Mat");
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.positionNode = instanceMatrix.mul(positionLocal);
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);

        return mat;
    }, [instanceMatrix]);

    const geometry = useMemo(() => {
        const g = new THREE.BoxGeometry(1, 1, 1);
        g.translate(0, 0.5, 0);
        return g;
    }, []);


    return <instancedMesh ref={meshRef} args={[geometry, compute_mat, count]} position={[0, 5, 0]} >
        {children}
    </instancedMesh>;
}


export function MeshRandomizer({ children }: PropsWithChildren) {

    const { transformsBuffer, count, offset } = useInstancedMeshSlice();

    useEffect(() => {
        console.log("Randomizer Mount")
        return () => { console.log("Randomizer Unmount") }
    }, [])

    useEffect(() => {
        console.log("COUNT CHANGED", count)
    }, [count])

    console.log("Randomizer", count, offset)
    // --- Generate IDs ---
    const ids = useMemo(() => {
        console.log("Randommizer Ids", count)
        const array = new Int16Array(count);
        for (let i = 0; i < count; i++) array[i] = i % 2;
        return array;
    }, [count]);

    // --- Compute Mesh Offsets ---
    const MeshIdCountsOffset = useMemo(() => {
        console.log("Randommizer MeshIdCountsOffset")
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
        console.log("Randommizer packedIndices")
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
        console.log("update Mesh Data")
        const result: Record<number, MeshDataEntry> = {};

        for (const key in MeshIdCountsOffset) {
            const meshId = Number(key);
            const { offset: mesh_offset, count } = MeshIdCountsOffset[meshId];
            const index = int(indexBuffer.element(instanceIndex.add(int(mesh_offset))));

            result[meshId] = {
                offset,
                count,
                instanceMatrix: transformsBuffer.element(index.add(offset))
            };
        }

        return result;
    }, [MeshIdCountsOffset, indexBuffer, transformsBuffer, offset]);

    return (
        <InstancedMeshSliceContext.Provider value={{ transformsBuffer, count, offset }}>
            <MeshRandomizerContext.Provider value={{ meshData }}>
                {children}
            </MeshRandomizerContext.Provider>
        </InstancedMeshSliceContext.Provider>
    );
}




export function TestNewGridScatter() {

    return (
        <InstanceTransformsProvider>
            <InstanceTransformsBufferGather>
                <GridScatter name="New Test" >
                    {1 &&
                        <InstancedSliceMesh >
                            <boxGeometry />
                        </InstancedSliceMesh>
                    }
                </GridScatter>

                <GridScatter name="New Test 2" spacing={3}>
                    <MeshRandomizer>
                        {1 &&
                            <InstancedSliceMesh >
                                <sphereGeometry />
                            </InstancedSliceMesh>
                        }

                        {1 &&
                            <InstanceMultiMesh mesh_id={0}>
                                <sphereGeometry />
                            </InstanceMultiMesh>
                        }

                        {1 &&
                            <InstanceMultiMesh mesh_id={1}>
                                <boxGeometry />
                            </InstanceMultiMesh>
                        }


                    </MeshRandomizer>
                </GridScatter>

                {0 && <InstancedSliceMesh />}



            </InstanceTransformsBufferGather>
        </InstanceTransformsProvider>
    );
}
