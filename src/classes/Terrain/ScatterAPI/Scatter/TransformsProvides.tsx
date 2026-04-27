import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { float, instanceIndex, mod, normalLocal, positionLocal, storage, clamp, transformNormalToView, vec4, int, mix, attribute, vec3, length, uv, screenUV, rand, step, uniform, min, abs, fract } from "three/tsl";
import { StorageBufferNode, StorageInstancedBufferAttribute } from "three/webgpu";
import * as THREE from "three/webgpu";
import { useGLTF } from "@react-three/drei";
import { useTerrain } from "../../TerrainProvider";
import { usePlayer } from "../../../Player/PlayerContext";
import { folder, useControls } from "leva";
import { Fn } from "three/src/nodes/TSL.js";

// ULTIMATE CLASS TO SCATTER STUFFS
// - split into indexes for different meshes
// - cast shadows
// - update snapping compute only when distance travalled ??
// - deterministic random offsets
// - terrain controls expose


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
    name: string
    showUI?: boolean
    seed?: number
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
    showUI: true,
    name: "Unnamed",
    seed: 0,
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
            offset_random: { value: props.offset_random as number, min: 0, max: 3, step: 0.01 },
            seed: { value: props.seed as number, min: 0, max: 9999, step: 1 }
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

interface NameContextType {
    name: string;
}

const NameContext = createContext<NameContextType | undefined>(undefined);

export function useName() {
    const ctx = useContext(NameContext);
    if (!ctx) throw new Error("useName must be used within a NameProvider");
    return ctx;
}

export function GridScatter(_props: PropsWithChildren<GridScatterProps>) {
    const { children, ...props } = _props;
    const gridScatterProps = useGridScatterControlsUI(props);

    const transforms = useMemo(() => {
        //console.log("GRID_SCATTER:Construct Transfroms")
        return createGridTransforms(gridScatterProps);
    }, [gridScatterProps])

    const gridContextValues = useMemo(() => {
        return {
            gridSize: gridScatterProps.cellCount * gridScatterProps.spacing,
            spacing: gridScatterProps.spacing,
            cellCount: gridScatterProps.cellCount,
        };
    }, [gridScatterProps.spacing, gridScatterProps.cellCount]);

    const nameContext = useMemo(() => ({ name: gridScatterProps.name }), [gridScatterProps.name]);

    if (!gridScatterProps.visible) return null;

    return <GridContext.Provider value={gridContextValues}>
        <NameContext.Provider value={nameContext}>
            <useTransformsContext.Provider value={{ transforms }}    >
                {children}
            </useTransformsContext.Provider></NameContext.Provider>
    </GridContext.Provider>;
}

export function GridScatterLayer(_props: PropsWithChildren<GridScatterProps>) {
    const { children, ...props } = _props;
    const gridScatterProps = useGridScatterControlsUI(props);
    const parent_transforms = useTransforms();

    const transforms = useMemo(() => {
        //console.log("GRID_SCATTER:Construct Transfroms")
        const inst_transform = createGridTransforms(gridScatterProps);

        return parent_transforms.transforms.flatMap(parent =>
            inst_transform.map(inst => {
                const m = new THREE.Matrix4();
                m.multiplyMatrices(parent, inst);
                return m;
            })
        );
    }, [gridScatterProps])

    const nameContext = useMemo(() => ({ name: gridScatterProps.name }), [gridScatterProps.name]);

    return <useTransformsContext.Provider value={{ transforms }}    >
        <NameContext.Provider value={nameContext}>
            {children}
        </NameContext.Provider>
    </useTransformsContext.Provider>;

}

import seedrandom from 'seedrandom'

export function randomN(
    seed: string | number,
    ...values: (number | string)[]
) {
    const key = [seed, ...values].join('_')
    const rng = seedrandom(key)
    return rng()
}

export function createGridTransforms(props: GridScatterProps) {
    const {
        cellCount = 10,
        spacing = 1,
        scale = 1,
        scale_random = 0,
        rotation_random = 0,
        offset_random = 0,
        seed = 0,
    } = props

    const transforms: THREE.Matrix4[] = []


    for (let x = 0; x < cellCount; x++) {
        for (let z = 0; z < cellCount; z++) {

            const position = new THREE.Vector3((x - (cellCount - 1) / 2) * spacing, 0, (z - (cellCount - 1) / 2) * spacing)

            const randOffset = new THREE.Vector3(randomN(x, z, seed, 1) - 0.5, 0, randomN(x, z, seed, 2) - 0.5)
            position.addScaledVector(randOffset, spacing * offset_random)

            const rotation = new THREE.Euler(0, randomN(x, z, seed, 3) * Math.PI * 2 * rotation_random, 0)
            const rotQuat = new THREE.Quaternion().setFromEuler(rotation)

            const s = scale * (1 - randomN(x, z, seed, 4) * scale_random)

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
        //console.log("update count");
        return transforms.length;
    }, [transforms])


    const transfomrsBufferAttribute = useMemo(() => {
        //console.log("Update Buffer")
        return new StorageInstancedBufferAttribute(new Float32Array(count * 16), 16);
    }, [count])

    const transformsBufferNode = useMemo(() =>
        storage(transfomrsBufferAttribute).setPBO(true)
        , [transfomrsBufferAttribute]);

    useEffect(() => {
        //console.log("Update Transforms")
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

export function HoverInstancedMeshCPU({ children }: PropsWithChildren) {
    //console.log("HOVER CHILD: ", "RENDER")
    const { transforms } = useTransforms();
    const meshRef = useRef<THREE.InstancedMesh>(null!)

    const count = useMemo(() => { return transforms.length; }, [transforms])

    const yellow = new THREE.Color("yellow")
    const green = new THREE.Color("green")

    useLayoutEffect(() => {
        const colors = new Float32Array(count * 3).map((_, i) => yellow.toArray()[i % 3]);
        meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    }, [count]);

    useLayoutEffect(() => {
        transforms.map((value, index) => { meshRef.current.setMatrixAt(index, value); })
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
        meshRef.current.computeBoundingBox();
    }, [transforms])

    const handleOver = (e: any) => {
        e.stopPropagation()
        const id = e.instanceId
        const mesh = meshRef.current
        mesh.instanceColor!.setXYZ(id, green.r, green.g, green.b)
        mesh.instanceColor!.needsUpdate = true
    }

    const handleOut = (e: any) => {
        const id = e.instanceId
        const mesh = meshRef.current
        mesh.instanceColor!.setXYZ(id, yellow.r, yellow.g, yellow.b)
        mesh.instanceColor!.needsUpdate = true
    }

    return <instancedMesh
        key={count}
        frustumCulled={false}
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
    >
        <boxGeometry />
        <meshStandardMaterial vertexColors />
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
    //console.log("GLTF", url, nodes);
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

export function DistanceFadeMaterialGPU() {
    const { transformsBufferNode } = useTransformsBuffer();
    const terrain = useTerrain();
    const player = usePlayer();
    const grid = useGrid();

    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])

    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial();
        //mat.side = THREE.DoubleSide

        // Calc Distance Mask
        const world_pivot = instanceMatrix.mul(vec4(0, 0, 0, 1));
        const start_dist = 0.75;
        const dist_mask_pow = 1;
        const distance_mask = remapFromMin(length(world_pivot.sub(player.tsl_PlayerWorldPosition).xz).div(grid.gridSize * 0.5), start_dist).oneMinus().pow(dist_mask_pow);

        // Calculate Position
        const pos_ws = instanceMatrix.mul(vec4(positionLocal, 1));
        mat.positionNode = pos_ws;

        // Calculate Normal
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);

        //Dithered Alpha
        const threshold = rand(screenUV.xy);
        //const threshold = rand(positionLocal);
        //const circle_tres = screenUV.mul(50).mul(vec2(screenSize.x.div(screenSize.y),1.0)).fract().sub(0.5).length();        
        const alpha = step(threshold, distance_mask);
        mat.maskNode = alpha;
        //mat.transparent = true;
        mat.alphaTest = 0.5;


        return mat;
    }, [instanceMatrix, terrain.tsl_sampleHeight, terrain.tsl_sampleN, player.tsl_PlayerWorldPosition, terrain.tsl_sampleColor, grid.gridSize]);

    return <primitive object={material} attach="material" />
}



export function GrassPivotMaterial({ use_distance_mask = true }) {
    const { transformsBufferNode } = useTransformsBuffer();
    const terrain = useTerrain();
    const player = usePlayer();
    const grid = useGrid();

    const controlled = useControls("Terrain", {
        "Heightfield": folder({
            tip_bright: { value: 4.0, min: 0, max: 5 },
            tip_sat: { value: 1.0, min: 0, max: 3 },
            tip_hue: { value: 0.0, min: -1, max: 1 },
        }, { collapsed: true })
    });

    const uniforms = useMemo(
        () => ({
            tip_bright: uniform(float(1.5)),
            tip_sat: uniform(float(1.0)),
            tip_hue: uniform(float(1.0)),
        }),
        []
    );

    // Update Uniforms
    useEffect(() => {
        uniforms.tip_bright.value = controlled.tip_bright;
        uniforms.tip_sat.value = controlled.tip_sat;
        uniforms.tip_hue.value = controlled.tip_hue;
    }, [controlled])


    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])

    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.side = THREE.DoubleSide
        // Pivot
        const pivot = attribute("_pivot", "vec3");
        const pivot_ws = instanceMatrix.mul(vec4(pivot, 1))
        // Calc Distance Mask
        const world_pivot = instanceMatrix.mul(vec4(0, 0, 0, 1));
        const start_dist = 0.1;
        const dist_mask_pow = 1 / 2;
        const distance_mask = use_distance_mask ?
            remapFromMin(length(world_pivot.sub(player.tsl_PlayerWorldPosition).xz).div(grid.gridSize * 0.5), start_dist).oneMinus().pow(dist_mask_pow)
            : float(1.0);

        // Calculate Position
        const pivot_height = terrain.tsl_sampleHeight(pivot_ws);
        const pos_ws = instanceMatrix.mul(mix(pivot, positionLocal, distance_mask)).add(vec3(0, pivot_height.y.sub(pivot_ws.y), 0));
        mat.positionNode = pos_ws;

        // Calculate Normal
        //const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        //mat.normalNode = transformNormalToView(normalWorld);
        const pivot_N = terrain.tsl_sampleN(pivot_ws);
        mat.normalNode = transformNormalToView(pivot_N.mul(2.0).sub(1.0).xzy)

        // Color
        const base_color = terrain.tsl_sampleColor(world_pivot)
        const bright_color = ToRgb(toHsv(base_color).mul(vec3(1, uniforms.tip_sat, uniforms.tip_bright)).add(vec3(uniforms.tip_hue, 0, 0)));
        const uv_mix = uv().y.pow(0.2).oneMinus();
        const dist_mix = distance_mask.pow(1)
        mat.colorNode = mix(base_color, bright_color, dist_mix.mul(uv_mix));

        return mat;
    }, [instanceMatrix, terrain.tsl_sampleHeight, terrain.tsl_sampleN, player.tsl_PlayerWorldPosition, terrain.tsl_sampleColor, grid.gridSize,use_distance_mask]);

    return <primitive object={material} attach="material" />
}

export const remapFromMin = (value: any, min: any) => {
    return clamp(value.sub(min).div(float(1.0).sub(min)), 0.0, 1.0)
}

export function toHsv(c: THREE.Node) {
    const K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);

    const p = mix(
        vec4(c.b, c.g, K.w, K.z),
        vec4(c.g, c.b, K.x, K.y),
        step(c.b, c.g)
    );

    const q = mix(
        vec4(p.x, p.y, p.w, c.r),
        vec4(c.r, p.y, p.z, p.x),
        step(p.x, c.r)
    );

    const d = q.x.sub(min(q.w, q.y));
    const e = float(1e-10);

    return vec3(
        abs(q.z.add(q.w.sub(q.y).div(d.mul(6.0).add(e)))),
        d.div(q.x.add(e)),
        q.x
    );
}

export function ToRgb(c: THREE.Node) {
    const K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    const p = abs(fract(c.xxx.add(K.xyz)).mul(6.0).sub(K.www));
    return c.z.mul(
        mix(K.xxx, clamp(p.sub(K.xxx), 0.0, 1.0), c.y)
    );
}




export function GrassScatter() {
    return <GridScatter
        name={"Grass"}
        spacing={1.3}
        cellCount={30}
        scale={3}
        rotation_random={1}
        offset_random={0}
        scale_random={0.3}
    >
        <SnapToTerrainHeightCPU>
            <TransformsBufferProvider>
                <WrapAroundPlayerGPU />
                <InstancedMeshSimple>
                    {1 && <GLTFGeometry url="models/GrassPivot.glb" />}
                    <GrassPivotMaterial />
                </InstancedMeshSimple>
            </TransformsBufferProvider>
        </SnapToTerrainHeightCPU>
    </GridScatter >
}


export function TreesScatter() {
    return <GridScatter
        name={"Trees New"}
        cellCount={10}
        scale={5}
        spacing={10}
        rotation_random={1}
        offset_random={1}
        visible={false}
    >
        <SnapToTerrainHeightCPU>
            <TransformsBufferProvider>
                <WrapAroundPlayerGPU />
                <InstancedMeshSimple>
                    {1 && <GLTFGeometry url="models/Tree.glb" />}
                    <DistanceFadeMaterialGPU />
                </InstancedMeshSimple>
            </TransformsBufferProvider>
        </SnapToTerrainHeightCPU>
    </GridScatter >
}





export function InteractiveBoxesScatter() {
    return <GridScatter name={"Interactive Boxes"} spacing={1.5} cellCount={15} visible={false}>
        <WrapAroundPlayer>
            <HoverInstancedMeshCPU>
                <boxGeometry />
                <meshStandardMaterial vertexColors />
            </HoverInstancedMeshCPU>
        </WrapAroundPlayer>
    </GridScatter>
}





export function TansformsProviderDebug() {
    return (
        <>
            <GridScatter name={"New Scatter Test"} spacing={3}>
                {false &&
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

                {false &&
                    <GridScatterLayer name={"Sub_Scatter"}>
                        <TransformsBufferProvider>
                            <WrapAroundPlayerGPU />
                            <InstancedMeshSimple>
                                <boxGeometry />
                                <InstancedTransformMaterial />
                            </InstancedMeshSimple>
                        </TransformsBufferProvider>
                    </GridScatterLayer>}
            </GridScatter >



        </>
    );
}



// WORK IN PROGRESS HERE


