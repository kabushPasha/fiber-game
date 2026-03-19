import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import * as THREE from "three"
import { type TerrainScatterProps } from "../../TerrainScatter";
import { useTerrainScatterControls } from "../../Scatter/ScatterUI";
import { useThree } from "@react-three/fiber";
import { storage } from "three/tsl";
import { StorageInstancedBufferAttribute } from "three/webgpu";

// Transforms Context ----------------------------------------------------------------------------
interface TransformsContextType {
    transforms: THREE.Matrix4[];
}

const useTransformsContext = createContext<TransformsContextType | undefined>(undefined);

export function useTransforms(): TransformsContextType {
    const ctx = useContext(useTransformsContext);
    if (!ctx) { throw new Error("useProject must be used within ProjectProvider"); }
    return ctx;
}


// Provider Grid Scatter ---------------------------------------------------------------------------
export function GridScatter(_props: PropsWithChildren<TerrainScatterProps>) {
    const { children, ...props } = _props;
    const { gridSize, spacing, scale, scale_random, rotation_random, offset_random } = useTerrainScatterControls(props);

    const transforms = useMemo(() => {
        console.log("GRID_SCATTER:Construct Transfroms")
        return createInstanceTransforms({
            gridSize,
            spacing,
            scale,
            scale_random,
            rotation_random,
            offset_random,
        });
    }, [gridSize, spacing, scale, scale_random, rotation_random, offset_random])


    return <useTransformsContext.Provider value={{ transforms }}    >
        {children}
    </useTransformsContext.Provider>;
}

export function createInstanceTransforms(props: TerrainScatterProps) {
    const {
        gridSize = 10,
        spacing = 1,
        scale = 1,
        scale_random = 0,
        rotation_random = 0,
        offset_random = 0
    } = props


    const transforms: THREE.Matrix4[] = []

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {

            const position = new THREE.Vector3((x - gridSize / 2) * spacing, 0, (z - gridSize / 2) * spacing)

            const randOffset = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
            position.addScaledVector(randOffset, spacing * offset_random)

            const rotation = new THREE.Euler(0, Math.random() * Math.PI * 2 * rotation_random, 0)
            const rotQuat = new THREE.Quaternion().setFromEuler(rotation)

            const s = scale * (1 - Math.random() * scale_random)

            transforms.push(
                new THREE.Matrix4().compose(
                    position,
                    rotQuat,
                    new THREE.Vector3(s, s, s)
                )
            )
        }
    }
    return transforms
}

// transforms Buffer Context -------------------------------------------------
interface TransformsBufferContextType {
    transformsBuffer: Node,
    count: number,
}

const useTransformsBufferContext = createContext<TransformsBufferContextType | undefined>(undefined);
export function useTransformsBuffer(): TransformsContextType {
    const ctx = useContext(useTransformsContext);
    if (!ctx) { throw new Error("useProject must be used within ProjectProvider"); }
    return ctx;
}

// --- Provider ------------------------

export function transformsBufferProvider({ children }: PropsWithChildren) {

    const {transforms} = useTransforms()

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    /*
    const transformsBuffer = useMemo(() => {
        return storage(new StorageInstancedBufferAttribute(transforms, 16))
    }, [transforms])


    const contextValue = useMemo(() => ({
        transformsBuffer,
        count
    }), [transformsBuffer, count]);
    */

    return <useTransformsBufferContext.Provider value={contextValue}    >
        {children}
    </useTransformsBufferContext.Provider>;
}




export function TansformsProviderDebug() {



    return (
        <>
            <GridScatter name={"New Scatter Test"}>

            </GridScatter>
        </>

    );
}