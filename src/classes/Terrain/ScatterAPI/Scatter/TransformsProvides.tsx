import { createContext, useContext, useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { type TerrainScatterProps } from "../../TerrainScatter";
import { useTerrainScatterControls } from "../../Scatter/ScatterUI";
import { useThree } from "@react-three/fiber";
import { instanceIndex, normalLocal, positionLocal, storage, transformNormalToView, vec4 } from "three/tsl";
import { StorageBufferNode, StorageInstancedBufferAttribute } from "three/webgpu";
import * as THREE from "three/webgpu";
import { useGLTF } from "@react-three/drei";

// ULTIMATE CLASS TO SCATTER STUFFS
// - inherit transforms
// - split into indexes for different meshes
// - cast shadows
// - adapt Grass
// - add simple Instance Option
// - snap to height, tile around player


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
        return createGridTransforms({
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

export function createGridTransforms(props: TerrainScatterProps) {
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
    transformsBufferNode: StorageBufferNode,
    count: number,
}

const useTransformsBufferContext = createContext<TransformsBufferContextType | undefined>(undefined);
export function useTransformsBuffer(): TransformsBufferContextType {
    const ctx = useContext(useTransformsBufferContext);
    if (!ctx) { throw new Error("useProject must be used within ProjectProvider"); }
    return ctx;
}

// --- transforms Buffer Provider ------------------------
export function TransformsBufferProvider({ children }: PropsWithChildren) {
    const { transforms } = useTransforms()

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    const count = useMemo(() => {
        console.log("update count");
        return transforms.length;
    }, [transforms])


    const transfomrsBufferAttribute = useMemo(() => {
        console.log("Update Buffer")
        return new StorageInstancedBufferAttribute(new Float32Array(count * 16), 16);
    }, [count])

    const transformsBufferNode = useMemo(() =>
        storage(transfomrsBufferAttribute).setPBO(true)
        , [transfomrsBufferAttribute]);

    useEffect(() => {
        console.log("Update Transforms")
        transfomrsBufferAttribute.array.set(flattenMatrix4Array(transforms))
        transfomrsBufferAttribute.needsUpdate = true;
    }, [transforms])

    const contextValue = useMemo(() => ({
        transformsBufferNode,
        count
    }), [transformsBufferNode, count]);

    return <useTransformsBufferContext.Provider value={contextValue}>
        {children}
    </useTransformsBufferContext.Provider>;
}

export function flattenMatrix4Array(
    matrices: THREE.Matrix4[]
): Float32Array {
    const count = matrices.length;
    const result = new Float32Array(count * 16);
    for (let i = 0; i < count; i++) {
        result.set(matrices[i].elements, i * 16);
    }
    return result;
}

// Instanced Mesh Simple
export function InstancedMeshSimple({ children }: PropsWithChildren) {
    const { count } = useTransformsBuffer();
    return <instancedMesh
        args={[undefined, undefined, count]}
        position={[0, 0, 0]}
        frustumCulled={false}
    >
        {children}
    </instancedMesh>;
}

export function InstancedMeshCPU({ children }: PropsWithChildren) {
    const { transforms } = useTransforms();
    const meshRef = useRef<THREE.InstancedMesh>(null!)

    const count = useMemo(() => { return transforms.length; }, [transforms])

    useEffect(() => {
        transforms.map((value,index) => {
            meshRef.current.setMatrixAt(index,value);
        })       

        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
        meshRef.current.computeBoundingBox();

    }, [transforms])


    return <instancedMesh
        frustumCulled={false}
        ref={meshRef}
        args={[undefined, undefined, count]}
    >
        {children}
    </instancedMesh>;
}



export function InstancedTransformMaterial() {
    const { transformsBufferNode } = useTransformsBuffer();

    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])

    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.positionNode = instanceMatrix.mul(positionLocal);
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);
        return mat;
    }, [instanceMatrix]);

    return <primitive object={material} attach="material" />
}

export function GLTFGeometry({ url }: { url: string }) {
    const { nodes } = useGLTF(url) as any
    // Memoize geometry extraction
    const geometry = useMemo(() => {
        const firstMesh = Object.values(nodes).find(
            (n: any) => n.isMesh && n.geometry instanceof THREE.BufferGeometry
        ) as THREE.Mesh | undefined
        if (!firstMesh) {
            console.warn("No mesh with geometry found in GLTF:", url)
            return null
        }
        return firstMesh.geometry
    }, [nodes, url])
    if (!geometry) return null
    return <primitive object={geometry} attach="geometry" />
}





export function TansformsProviderDebug() {
    return (
        <>
            <GridScatter name={"New Scatter Test"}>
                <TransformsBufferProvider>
                    <InstancedMeshSimple>
                        <boxGeometry />
                        <GLTFGeometry url="models/Tree.glb" />
                        <InstancedTransformMaterial />
                    </InstancedMeshSimple>
                </TransformsBufferProvider>


                <InstancedMeshCPU>
                    <boxGeometry />
                </InstancedMeshCPU>
            </GridScatter>
        </>
    );
}



// WORK IN PROGRESS HERE


