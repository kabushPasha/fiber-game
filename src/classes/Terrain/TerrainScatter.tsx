import { useRef, useMemo } from "react"
import * as THREE from "three"
import {
    attribute,
    cameraPosition,
    clamp,
    float,
    instanceIndex,
    int,
    length,
    mix,
    mod,
    modelWorldMatrixInverse,
    normalLocal,
    positionLocal,
    rand,
    screenUV,
    step,
    storage,
    time,
    transformNormalToView,
    uniform,
    uv,
    vec3,
    vec4,
} from "three/tsl"
import { MeshStandardNodeMaterial, Node, StorageInstancedBufferAttribute } from "three/webgpu"
import { useTerrain } from "./TerrainProvider"
import { folder, useControls } from "leva"
import { Fn, mat4 } from "three/src/nodes/TSL.js"
import { useGLTF } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { usePlayer } from "../Player/PlayerContext"


// -- Utility Functions --
export function createInstanceTransforms(props: TerrainScatterProps) {
    const {
        gridSize = 10,
        spacing = 1,
        scale = 1,
        scale_random = 0,
        rotation_random = 0,
        offset_random = 0
    } = props

    const count = gridSize * gridSize
    const transforms = new Float32Array(count * 16)

    const dummy = new THREE.Object3D()
    const randOffset = new THREE.Vector3()

    let index = 0

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {

            dummy.position.set(
                (x - gridSize / 2) * spacing,
                0,
                (z - gridSize / 2) * spacing
            )

            randOffset.set(Math.random() - 0.5, 0, Math.random() - 0.5)
            dummy.position.addScaledVector(randOffset, spacing * offset_random)

            dummy.rotation.y = Math.random() * Math.PI * 2 * rotation_random

            const s = scale * (1 - Math.random() * scale_random)
            dummy.scale.set(s, s, s)

            dummy.updateMatrix()
            dummy.matrix.toArray(transforms, index * 16)

            index++
        }
    }

    return transforms
}




// ---------- CONTEXT --------------------------

import { createContext, useContext } from "react"
import { useTerrainScatterControls } from "./Scatter/ScatterUI"

export type ScatterContextType = {
    transformsBuffer: Node
    instanceMatrix: Node
    zone_size: number
}

export const ScatterContext = createContext<ScatterContextType | null>(null)

export function useScatter() {
    const ctx = useContext(ScatterContext)
    if (!ctx) throw new Error("useScatter must be used inside TerrainScatter")
    return ctx
}

// ---------- Provider --------------------------

export type TerrainScatterProps = {
    visible?: boolean
    geometry?: THREE.BufferGeometry | null
    gridSize?: number
    spacing?: number
    rotation_random?: number
    scale?: number
    scale_random?: number
    offset_random?: number
    children?: React.ReactNode
    name?: string
    showUI?: boolean
}

export function TerrainScatter(_props: TerrainScatterProps) {
    const props = useTerrainScatterControls(_props)
    const { geometry: inputGeometry, gridSize, spacing, rotation_random, scale, scale_random,offset_random, children, name,} = props;

    const meshRef = useRef<THREE.InstancedMesh>(null!)

    const geometry = useMemo(() => {
        if (inputGeometry) return inputGeometry
        const g = new THREE.BoxGeometry(1, 1, 1)
        g.translate(0, 0.5, 0)
        return g
    }, [inputGeometry])

    const count = gridSize * gridSize
    const zone_size = gridSize * spacing;

    // Precompute instance transforms
    const instanceTransforms = useMemo(() => {
        return createInstanceTransforms({ gridSize, spacing, scale, scale_random, rotation_random, offset_random })
    }, [gridSize, spacing, scale, scale_random, rotation_random, offset_random])

    const { hf_size, hf_tex, hf_height, tsl_sampleHeight } = useTerrain()

    // Create material after mesh exists
    const sticky_material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.side = THREE.DoubleSide

        // Positions
        const transformsStorage = storage(new StorageInstancedBufferAttribute(instanceTransforms, 16))
        const instanceMatrix = transformsStorage.element(instanceIndex)

        //const objCenter = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).setY(float(0.0));
        const objCenter = cameraPosition.setY(float(0.0)); // Obj we Follow
        const instanceCenter = instanceMatrix.mul(vec4(0, 0, 0, 1));

        // Calc snapped Position        
        const mod_rel_pos = SnappedRelativePosition(instanceCenter, objCenter, zone_size);
        const snap_offset = mod_rel_pos.add(objCenter).sub(instanceCenter);

        // Sample Height
        const worldCenter = instanceMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).add(snap_offset)
        const heightSample = tsl_sampleHeight(worldCenter);

        const distance_sacle = length(mod_rel_pos).sub(0).div(zone_size * 0.5).oneMinus().clamp(0, 1).pow(1)
        //const scaled_localPos = positionLocal.mul(vec3(1, distance_sacle, 1))
        // Scale to root 
        const scaled_localPos = mix(positionLocal, vec3(0.0), distance_sacle.oneMinus());
        const final_local_pos = positionLocal;

        const instancePos = instanceMatrix.mul(vec4(final_local_pos, 1))
        const final_pos = instancePos.add(snap_offset.setY(heightSample));

        // Final Position
        mat.positionNode = modelWorldMatrixInverse.mul(final_pos).xyz;

        // Normal
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

        //Dithered Alpha
        const distanceFactor = length(mod_rel_pos).div(zone_size * 0.5);
        const distanceFactor_clamped = clamp(distanceFactor.oneMinus(), 0.0, 1.0);
        //different tresholds
        const threshold = rand(screenUV.xy);
        //const circle_tres = screenUV.mul(50).mul(vec2(screenSize.x.div(screenSize.y),1.0)).fract().sub(0.5).length();        
        const alpha = step(threshold, distanceFactor_clamped.pow(0.5));

        //mat.maskNode = alpha;
        mat.transparent = true;

        return mat
    }, [instanceTransforms, hf_size, hf_tex, hf_height, zone_size])


    // -------------   Compute Position Updates ----------------------------------

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    const uniforms = useMemo(
        () => ({
            playerPosition: uniform(new THREE.Vector3(0, 0, 0)),
        }),
        []
    );

    const transformsBuffer = useMemo(() => {
        return storage(new StorageInstancedBufferAttribute(instanceTransforms, 16))
    }, [instanceTransforms])

    const instanceMatrix = useMemo(() => {
        return transformsBuffer.element(instanceIndex)
    }, [transformsBuffer])

    // update Fn
    const computeUpdate = useMemo(() => {
        return Fn(() => {
            const worldPos = instanceMatrix.mul(vec4(0, 0, 0, 1));
            const offset = instanceMatrix.element(int(3));

            // Snap Around Player
            const player_relative_pos = SnappedRelativePosition(worldPos, uniforms.playerPosition, zone_size);
            const wrapped_world = player_relative_pos.add(uniforms.playerPosition);
            //Get Height
            const heightSample = tsl_sampleHeight(wrapped_world);
            offset.assign(offset.setX(wrapped_world.x).setZ(wrapped_world.z).setY(heightSample));

            //instanceMatrix.assign();
        })().compute(count);
    }, [instanceMatrix, count, tsl_sampleHeight, uniforms]);

    const { player } = usePlayer();

    useFrame(() => {
        if (!props.visible) return;
        const world_pos = new THREE.Vector3(0, 0, 0)
        player?.getWorldPosition(world_pos);
        uniforms.playerPosition.value = world_pos;
        renderer.compute(computeUpdate)
    })

    // Create material after mesh exists
    const compute_mat = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.side = THREE.DoubleSide

        mat.positionNode = transformsBuffer.element(instanceIndex).mul(positionLocal)
        // Normal
        const normalWorld = transformsBuffer.element(instanceIndex).mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

        return mat
    }, [hf_size, hf_tex, hf_height, zone_size, transformsBuffer])

    return (
        <ScatterContext.Provider value={{ transformsBuffer, instanceMatrix, zone_size }}>
            <instancedMesh
                visible={props.visible}
                frustumCulled={false}
                ref={meshRef}
                position={[0, 0, 0]}
                args={[
                    geometry,
                    compute_mat,
                    count
                ]}
                name={name}
            >
                {children}
            </instancedMesh>
        </ScatterContext.Provider>
    )
}

export const SnappedRelativePosition = Fn(
    ([instanceCenter, objCenter, zone_size]: [Node, Node, Node]) => {
        // relative position to the object center, ignoring Y
        const rel_pos = instanceCenter.sub(objCenter).setY(float(0));
        // modulo for snapping within zone size
        return mod(rel_pos.add(zone_size.div(2.0)), zone_size).sub(zone_size.div(2.0));
    }
);

export const translationMatrix = Fn(([offset]: [any]) => {
    return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        offset.x, offset.y, offset.z, 1.0
    );
})

// ------- MATERIALS ---------------
export function TerrainFadeMaterial() {
    const { instanceMatrix, zone_size } = useScatter()

    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        //mat.side = THREE.DoubleSide

        // Calc Distance Mask
        const world_pivot = instanceMatrix.mul(vec4(0, 0, 0, 1));

        const start_dist = 0.75;
        const dist_mask_pow = 1;
        const distance_mask = remapFromMin(length(world_pivot.sub(cameraPosition).xz).div(zone_size * 0.5), start_dist).oneMinus().pow(dist_mask_pow);
        const scale_pos = positionLocal.mul(distance_mask)

        // Position
        const worldPos = instanceMatrix.mul(vec4(positionLocal, 1))
        mat.positionNode = worldPos.xyz
        // Normal
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

        //Dithered Alpha
        const threshold = rand(screenUV.xy);
        //const threshold = rand(positionLocal);
        //const circle_tres = screenUV.mul(50).mul(vec2(screenSize.x.div(screenSize.y),1.0)).fract().sub(0.5).length();        
        const alpha = step(threshold, distance_mask);
        mat.maskNode = alpha;
        mat.transparent = true;

        mat.colorNode = distance_mask;

        return mat

    }, [instanceMatrix, zone_size])

    return <primitive object={material} attach="material" />
}

// ------- MATERIALS ---------------
export function TerrainPivotMaterial() {
    const { instanceMatrix, zone_size } = useScatter()
    const { tsl_sampleHeight, tsl_sampleN, tsl_sampleColor } = useTerrain()

    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.side = THREE.DoubleSide

        const root_pos = attribute("uv1", "vec2");
        const pivot = vec3(root_pos.x, 0, root_pos.y.oneMinus())
        const pivot_ws = instanceMatrix.mul(vec4(pivot, 1))
        const pivot_height = tsl_sampleHeight(pivot_ws);
        const pivot_N = tsl_sampleN(pivot_ws);

        // Calc Distance Mask
        const world_pivot = instanceMatrix.mul(vec4(0, 0, 0, 1));
        const start_dist = 0.1;
        const dist_mask_pow = 1 / 2;
        const distance_mask = remapFromMin(length(world_pivot.sub(cameraPosition).xz).div(zone_size * 0.5), start_dist).oneMinus().pow(dist_mask_pow);
        //const scale_pos = positionLocal.mul(distance_mask)        

        const scale_pos = mix(pivot, positionLocal, distance_mask);

        // Position
        const worldPos = instanceMatrix.mul(vec4(scale_pos, 1))
        mat.positionNode = worldPos.xyz.sub(vec3(0, world_pivot.y.sub(pivot_height), 0));

        // Normal
        //const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(pivot_N.mul(2.0).sub(1.0).xzy)

        //Dithered Alpha - Looks Bad On Grass
        const threshold = rand(screenUV.xy);
        //const circle_tres = screenUV.mul(50).mul(vec2(screenSize.x.div(screenSize.y),1.0)).fract().sub(0.5).length();        
        const alpha = step(threshold, distance_mask);
        //mat.maskNode = alpha;
        //mat.transparent = true;


        // Color
        const base_color = tsl_sampleColor(world_pivot)
        const bright_color = vec3(0.9, 2, 0.9)
        const uv_mix = uv().y.pow(0.2).oneMinus();
        const dist_mix = distance_mask.pow(1)
        mat.colorNode = mix(base_color, bright_color, dist_mix.mul(uv_mix));
        //mat.colorNode = mix(base_color, bright_color, uv_mix);

        return mat

    }, [instanceMatrix, zone_size, tsl_sampleHeight, tsl_sampleN])

    return <primitive object={material} attach="material" />
}



export const remapFromMin = (value: any, min: any) => {
    return clamp(value.sub(min).div(float(1.0).sub(min)), 0.0, 1.0)
}

export function LoadGltfGeo({ url }: { url: string }) {
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