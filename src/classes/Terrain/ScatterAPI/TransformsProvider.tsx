import { createContext, useContext, useMemo, useEffect, type PropsWithChildren, useState, useCallback, useRef } from "react";
import { StorageInstancedBufferAttribute } from "three/webgpu";
import { storage, instanceIndex, int } from "three/tsl";
import { createInstanceTransforms, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";
import * as THREE from "three/webgpu";

// --- Transforms Context ---
interface TransformsContextType {
    count: number;
    instanceTransforms: Float32Array;
    transformsBuffer: ReturnType<typeof storage>;
    transformsAtt: StorageInstancedBufferAttribute;
    instanceMatrix: THREE.Node;
    addTransforms: (newTransforms: Float32Array | null, id: number | null) => number;
    offsetTable: Record<number, number>;
}

const TransformsContext = createContext<TransformsContextType | undefined>(undefined);

export const useTransforms = () => {
    const context = useContext(TransformsContext);
    if (!context) throw new Error("useTransforms must be used within a TransformsProvider");
    return context;
};



// --- Provider Component ---
export function TransformsProvider({ children }: PropsWithChildren) {
    const [instanceTransforms, setInstanceTransforms] = useState<Float32Array>(new Float32Array());

    const count = useMemo(() => { return instanceTransforms.length / 16 }, [instanceTransforms])

    // --- Buffer & Attribute ---
    const transformsAtt = useMemo(() => new StorageInstancedBufferAttribute(instanceTransforms, 16), [count]);
    const transformsBuffer = useMemo(() => storage(transformsAtt).setPBO(true), [transformsAtt]);
    const instanceMatrix = useMemo(() => transformsBuffer.element(instanceIndex), [transformsBuffer]);

    const [idTable, setIdTable] = useState<Record<number, Float32Array>>({})
    const [offsetTable, setOffsetTable] = useState<Record<number, number>>({});
    // --- Sync updates ---

    useEffect(() => {
        transformsAtt.array.set(instanceTransforms);
        transformsAtt.needsUpdate = true;
    }, [instanceTransforms]);

    useEffect(() => {
        //console.log("Table Changed", idTable);
        const entries = Object.entries(idTable).sort(([a], [b]) => Number(a) - Number(b));
        const totalLength = entries.reduce((sum, [, arr]) => sum + arr.length, 0);
        const combined = new Float32Array(totalLength);
        const newOffsets: Record<number, number> = {};
        let floatOffset = 0;
        for (const [idStr, arr] of entries) {
            const id = Number(idStr);
            newOffsets[id] = floatOffset / 16;
            combined.set(arr, floatOffset);
            floatOffset += arr.length;
        }

        setOffsetTable(newOffsets);
        setInstanceTransforms(combined);

    }, [idTable]);

    const nextIdRef = useRef(0);

    // --- Add new transforms dynamically ---
    const addTransforms = useCallback(
        (newTransforms: Float32Array | null, id: number | null) => {
            let assignedId = id;

            // REMOVE
            if (newTransforms === null) {
                if (assignedId == null) return assignedId;

                setIdTable(prev => {
                    if (prev[assignedId!] === undefined) return prev;
                    const copy = { ...prev };
                    delete copy[assignedId!];
                    return copy;
                });

                return assignedId;
            }

            // ASSIGN ID (sync + safe)
            if (assignedId == null) {
                assignedId = nextIdRef.current++;
            }

            // ADD / UPDATE
            setIdTable(prev => ({
                ...prev,
                [assignedId!]: newTransforms
            }));

            return assignedId;
        },
        []
    );
    return (
        <TransformsContext.Provider
            // THIS IS AN OLD CLASS I MIGHT DELETE IT - im using Newer TransformsProviderFrom ScatterApi/Scatter
            //@ts-ignore
            value={{ count, instanceTransforms, transformsBuffer, transformsAtt, instanceMatrix, addTransforms, offsetTable }}
        >
            {children}
        </TransformsContext.Provider>
    );
}


export function GridScatter(_props: PropsWithChildren<TerrainScatterProps>) {
    const { children, ...props } = _props;
    const { gridSize, spacing, scale, scale_random, rotation_random, offset_random } = useTerrainScatterControls(props);
    const { addTransforms, transformsBuffer, transformsAtt, instanceTransforms, offsetTable } = useTransforms();

    const count = useMemo(() => gridSize * gridSize, [gridSize])
    const id = useRef<number | null>(null)

    const localTransforms = useMemo(() => {
        //console.log("GRID_SCATTER:Construct Transfroms")
        return createInstanceTransforms({
            gridSize,
            spacing,
            scale,
            scale_random,
            rotation_random,
            offset_random,
        });
    }, [gridSize, spacing, scale, scale_random, rotation_random, offset_random])


    useEffect(() => {
        id.current = addTransforms(localTransforms, id.current);
        return () => { addTransforms(null, id.current); };
    }, [addTransforms, localTransforms]);

    const instanceMatrix = useMemo(() => {
        if (!id.current) return transformsBuffer.element(instanceIndex)
        const offset = offsetTable[id.current]
        return transformsBuffer.element(instanceIndex.add(int(offset)))
    }, [transformsBuffer, offsetTable])

    return <TransformsContext.Provider
        value={{ count, instanceTransforms, transformsBuffer, transformsAtt, instanceMatrix, addTransforms, offsetTable }}
    >
        {children}
    </TransformsContext.Provider>;
}








