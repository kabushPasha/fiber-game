import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { float, instanceIndex, mod, normalLocal, positionLocal, storage, transformNormalToView, vec4, sub, div, int } from "three/tsl";
import { StorageBufferNode, StorageInstancedBufferAttribute } from "three/webgpu";
import * as THREE from "three/webgpu";
import { useGLTF } from "@react-three/drei";
import { useTerrain } from "../../TerrainProvider";
import { usePlayer } from "../../../Player/PlayerContext";
import { folder, useControls } from "leva";
import { Fn } from "three/src/nodes/TSL.js";

// ULTIMATE CLASS TO SCATTER STUFFS
// - inherit transforms
// - split into indexes for different meshes
// - cast shadows
// - adapt Grass
// - update snapping compute only when 
// - deterministic random offsets


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

export type GridScatterProps = {
    visible?: boolean
    geometry?: THREE.BufferGeometry | null
    cellCount?: number
    spacing?: number
    rotation_random?: number
    scale?: number
    scale_random?: number
    offset_random?: number
    children?: React.ReactNode
    name?: string
    showUI?: boolean
}

type GridScatterPropsResolved =
    GridScatterProps &
    Required<Pick<
        GridScatterProps,
        "cellCount" |
        "spacing" |
        "rotation_random" |
        "scale" |
        "scale_random" |
        "offset_random"
    >>

const GridScatterProps_defaults: GridScatterProps = {
    visible: true,
    geometry: null,
    cellCount: 5,
    spacing: 1,
    rotation_random: 0,
    scale: 1,
    scale_random: 0,
    offset_random: 0,
    children: null,
    name: "Scattered",
    showUI: true
};

export function useGridScatterControlsUI(_props: GridScatterProps): GridScatterPropsResolved {
    const props = { ...GridScatterProps_defaults, ..._props };
    if (!props.showUI) return props as GridScatterPropsResolved;

    const controlled_props = useControls("Terrain", {
        [props.name as string]: folder({
            visible: { value: props.visible as boolean },
            cellCount: { value: props.cellCount as number, min: 1, max: 1000, step: 1 },
            spacing: { value: props.spacing as number, min: 0.1, max: 100, step: 0.1 },
            rotation_random: { value: props.rotation_random as number, min: 0, max: 1, step: 0.01 },
            scale: { value: props.scale as number, min: 0.01, max: 10, step: 0.01 },
            scale_random: { value: props.scale_random as number, min: 0, max: 1, step: 0.01 },
            offset_random: { value: props.offset_random as number, min: 0, max: 3, step: 0.01 }
        }, { collapsed: true })
    })

    return { ...props, ...controlled_props }
}

interface GridContextType {
    gridSize: number;
    spacing: number;
    cellCount: number;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export function useGrid() {
    const ctx = useContext(GridContext);
    if (!ctx) throw new Error("useGrid must be used within GridProvider");
    return ctx;
}

export function GridScatter(_props: PropsWithChildren<GridScatterProps>) {
    const { children, ...props } = _props;
    const gridScatterProps = useGridScatterControlsUI(props);

    const transforms = useMemo(() => {
        console.log("GRID_SCATTER:Construct Transfroms")
        return createGridTransforms(gridScatterProps);
    }, [gridScatterProps])

    const gridContextValues = useMemo(() => {
        return {
            gridSize: gridScatterProps.cellCount * gridScatterProps.spacing,
            spacing: gridScatterProps.spacing,
            cellCount: gridScatterProps.cellCount,
        };
    }, [gridScatterProps.spacing, gridScatterProps.cellCount]);

    return <GridContext.Provider value={gridContextValues}>
        <useTransformsContext.Provider value={{ transforms }}    >
            {children}
        </useTransformsContext.Provider>
    </GridContext.Provider>;
}

export function GridScatterLayer(_props: PropsWithChildren<GridScatterProps>) {
    const { children, ...props } = _props;
    const gridScatterProps = useGridScatterControlsUI(props);
    const parent_transforms = useTransforms();


    const transforms = useMemo(() => {
        console.log("GRID_SCATTER:Construct Transfroms")
        const inst_transform = createGridTransforms(gridScatterProps);

        return parent_transforms.transforms.flatMap(parent =>
            inst_transform.map(inst => {
                const m = new THREE.Matrix4();
                m.multiplyMatrices(parent, inst);
                return m;
            })
        );

    }, [gridScatterProps])


    return <useTransformsContext.Provider value={{ transforms }}    >
        {children}
    </useTransformsContext.Provider>;

}


export function createGridTransforms(props: GridScatterProps) {
    const {
        cellCount = 10,
        spacing = 1,
        scale = 1,
        scale_random = 0,
        rotation_random = 0,
        offset_random = 0
    } = props

    const transforms: THREE.Matrix4[] = []

    for (let x = 0; x < cellCount; x++) {
        for (let z = 0; z < cellCount; z++) {

            const position = new THREE.Vector3((x - (cellCount - 1) / 2) * spacing, 0, (z - (cellCount - 1) / 2) * spacing)

            const randOffset = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
            position.addScaledVector(randOffset, spacing * offset_random)
            1
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
        transforms.map((value, index) => {
            meshRef.current.setMatrixAt(index, value);
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

export function SnapToTerrainHeightCPU({ children }: PropsWithChildren) {
    const terrain = useTerrain();
    const { transforms } = useTransforms();

    const snappedTransforms = useMemo(() => {
        return transforms.map((transform) => {
            return snapToHeightfield(transform.clone(), terrain);
        })
    }, [transforms])

    const context = useMemo(() => ({
        transforms: snappedTransforms
    }), [snappedTransforms])

    return <useTransformsContext.Provider value={context}    >
        {children}
    </useTransformsContext.Provider>;
}

export function WrapAroundPlayer({ children }: PropsWithChildren) {
    const { transforms } = useTransforms();
    const player = usePlayer()
    const [wrappedTransfroms, setWrappedTransforms] = useState<THREE.Matrix4[] | null>(null);
    const grid = useGrid()
    const terrain = useTerrain()

    useFrame(() => {
        if (!wrappedTransfroms) return;
        setWrappedTransforms(
            wrappedTransfroms.map((t) => {
                return wrapAroundPlayer(t.clone(), player.playerWorldPosition, grid, terrain);
            })
        )
    })

    useEffect(() => {
        setWrappedTransforms(
            transforms.map((t) => {
                const wrapped_pos = wrapAroundPlayer(t.clone(), player.playerWorldPosition, grid);
                return snapToHeightfield(wrapped_pos, terrain);
            })
        )
    }, [transforms])

    const context = useMemo(() => ({
        transforms: wrappedTransfroms ?? []
    }), [wrappedTransfroms])

    return (
        <useTransformsContext.Provider value={context}>
            {children}
        </useTransformsContext.Provider>
    );
}


export function WrapAroundPlayerGPU() {
    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer
    const { transformsBufferNode, count } = useTransformsBuffer();
    const terrain = useTerrain()
    const player = usePlayer()
    const grid = useGrid()


    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])

    // update Fn
    const computeUpdate = useMemo(() => {
        return Fn(() => {
            const worldPos = instanceMatrix.mul(vec4(0, 0, 0, 1));
            const offset = instanceMatrix.element(int(3));

            // Snap Around Player
            const player_relative_pos = SnappedRelativePosition(worldPos, player.tsl_PlayerWorldPosition, grid.gridSize);
            const wrapped_world = player_relative_pos.add(player.tsl_PlayerWorldPosition);
            //Get Height
            const heightSample = terrain.tsl_sampleHeight(wrapped_world);
            offset.assign(offset.setX(wrapped_world.x).setZ(wrapped_world.z).setY(heightSample));

        })().compute(count);
    }, [instanceMatrix, count, terrain.tsl_sampleHeight, player.tsl_PlayerWorldPosition, grid.gridSize]);


    useFrame(() => { renderer.compute(computeUpdate) })

    return null;
}

export const SnappedRelativePosition = Fn(
    ([instanceCenter, objCenter, zone_size]: [THREE.Node, THREE.Node, THREE.Node]) => {
        // relative position to the object center, ignoring Y
        const rel_pos = instanceCenter.sub(objCenter).setY(float(0));
        // modulo for snapping within zone size
        return mod(rel_pos.add(zone_size.div(2.0)), zone_size).sub(zone_size.div(2.0));
    }
);

export function snapToHeightfield(
    transform: THREE.Matrix4,
    terrain: { getHeightAtPos: (pos: THREE.Vector3) => number }
): THREE.Matrix4 {
    const pos = getPositionFromMatrix(transform);
    pos.y = terrain.getHeightAtPos(pos);

    return transform.setPosition(pos);
}

function euclideanModulo(n: number, m: number) {
    return ((n % m) + m) % m;
}

export function getPositionFromMatrix(matrix: THREE.Matrix4): THREE.Vector3 {
    const position = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    return position;
}

export function wrapAroundPlayer(
    transform: THREE.Matrix4,
    playerPos: THREE.Vector3,
    grid: GridContextType,
    terrain?: { getHeightAtPos: (pos: THREE.Vector3) => number }
): THREE.Matrix4 {
    const pos = getPositionFromMatrix(transform);
    const zoneSize = grid.gridSize;
    const moded = Math.abs(playerPos.x - pos.x) > zoneSize * 0.5 || Math.abs(playerPos.z - pos.z) > zoneSize * 0.5;

    // Wrap X and Z around player
    pos.x = playerPos.x + euclideanModulo(pos.x - playerPos.x + zoneSize / 2, zoneSize) - zoneSize / 2;
    pos.z = playerPos.z + euclideanModulo(pos.z - playerPos.z + zoneSize / 2, zoneSize) - zoneSize / 2;
    // Snap to terrain if offseted
    if (terrain && moded) { pos.y = terrain.getHeightAtPos(pos); }

    transform.setPosition(pos);
    return transform;
}



export function TansformsProviderDebug() {
    return (
        <>
            <GridScatter name={"New Scatter Test"} spacing={3}>
                {true &&
                    <SnapToTerrainHeightCPU>
                        <TransformsBufferProvider>
                            <WrapAroundPlayerGPU />
                            <InstancedMeshSimple>
                                <boxGeometry />
                                {1 && <GLTFGeometry url="models/Tree.glb" />}
                                <InstancedTransformMaterial />
                            </InstancedMeshSimple>
                        </TransformsBufferProvider>
                    </SnapToTerrainHeightCPU>}


                {false &&
                    <WrapAroundPlayer>
                        <InstancedMeshCPU>

                            <boxGeometry />
                            <meshStandardMaterial />

                        </InstancedMeshCPU>
                    </WrapAroundPlayer>}


                <GridScatterLayer name={"Sub_Scatter"}>
                    <TransformsBufferProvider>
                        <WrapAroundPlayerGPU/>
                        <InstancedMeshSimple>
                            <boxGeometry />
                            <InstancedTransformMaterial />
                        </InstancedMeshSimple>
                    </TransformsBufferProvider>


                </GridScatterLayer>


            </GridScatter >
        </>
    );
}



// WORK IN PROGRESS HERE


