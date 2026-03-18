import React, { createContext, useContext, useState, useCallback, useEffect, type PropsWithChildren, useMemo, useRef } from "react";
import { createInstanceTransforms, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";
import { Node, StorageInstancedBufferAttribute } from "three/webgpu";
import { instanceIndex, int, normalLocal, positionLocal, storage, transformNormalToView, vec4 } from "three/tsl";
import * as THREE from "three/webgpu";

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

    if (id == null) return;
    return <SliceFromId id={id}>{children}</SliceFromId>;
}

interface SliceFromIdProps {
    id: string;
}

export function SliceFromId({ id, children }: PropsWithChildren<SliceFromIdProps>) {
    const offsetTable = useOffsetTable();
    const instancedMeshSlice = useInstancedMeshSlice();
    const slice = offsetTable[id];

    if (!slice) {
        console.warn(`SliceFromId: offset for id ${id} not found yet`);
        return null; 
    }

    const { offset, count } = slice;

    
    const { transformsBuffer } = instancedMeshSlice;

    return (
        <InstancedMeshSliceContext.Provider value={{ transformsBuffer, count, offset }}>
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

    // Update instance Transforms, and offsets with Counts
    useEffect(() => {
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
        setOffsetTable(newOffsets);

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


    return (
        <OffsetTableContext.Provider value={offsetTable}>
            <InstancedMeshSliceContext.Provider value={{ transformsBuffer, count, offset: 0 }}>
                {children}
            </InstancedMeshSliceContext.Provider>
        </OffsetTableContext.Provider>
    );
}

// --- InstanceMesh using Context ---
export function InstancedSliceMesh({ children }: PropsWithChildren) {
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


export function TestNewGridScatter() {

    return (
        <InstanceTransformsProvider>
            <InstanceTransformsBufferGather>
                <GridScatter name="New Test" >
                    <InstancedSliceMesh >
                        <boxGeometry />
                    </InstancedSliceMesh>
                </GridScatter>

                <GridScatter name="New Test 2" >
                    <InstancedSliceMesh >
                        <sphereGeometry />
                    </InstancedSliceMesh>
                </GridScatter>

                {0 && <InstancedSliceMesh />}

            </InstanceTransformsBufferGather>
        </InstanceTransformsProvider>
    );
}
