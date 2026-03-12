import { useRef, useMemo } from "react"
import * as THREE from "three"
import {
    cameraPosition,
    clamp,
    float,
    instanceIndex,
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
    transformNormalToView,
    vec3,
    vec4,
} from "three/tsl"
import { MeshStandardNodeMaterial, Node, StorageInstancedBufferAttribute } from "three/webgpu"
import { useTerrain } from "./TerrainProvider"
import { folder, useControls } from "leva"
import { Fn } from "three/src/nodes/TSL.js"


export type TerrainScatterProps = {
    gridSize?: number
    spacing?: number
    rotation_random?: number
    scale?: number
    scale_random?: number
}


export function TerrainScatter({
    gridSize = 5,
    spacing = 1,
    rotation_random = 1,
    scale = 1,
    scale_random = 1,
}: TerrainScatterProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!)

    const geometry = useMemo(() => {
        const g = new THREE.BoxGeometry(1, 1, 1)
        g.translate(0, 0.5, 0)
        return g
    }, [])

    const count = gridSize * gridSize
    const zone_size = gridSize * spacing;

    // Precompute instance transforms
    const instanceTransforms = useMemo(() => {
        const transforms = new Float32Array(count * 16) // 16 floats per mat4
        const dummy = new THREE.Object3D()
        let index = 0

        for (let x = 0; x < gridSize; x++) {
            for (let z = 0; z < gridSize; z++) {
                dummy.position.set(
                    (x - gridSize / 2) * spacing + Math.random() * 0,
                    0,
                    (z - gridSize / 2) * spacing + Math.random() * 0
                )

                // random rotation for natural look
                dummy.rotation.y = Math.random() * Math.PI * 2 * rotation_random

                // slight scale variation
                const s = scale * (1 - Math.random() * scale_random)
                dummy.scale.set(s, s, s)

                dummy.updateMatrix()
                dummy.matrix.toArray(transforms, index * 16)
                index++
            }
        }

        return transforms
    }, [gridSize, spacing,scale,scale_random,rotation_random])

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

        mat.maskNode = alpha;
        mat.transparent = true;

        return mat
    }, [instanceTransforms, hf_size, hf_tex, hf_height, zone_size])


    return (
        <instancedMesh
            frustumCulled={false}
            ref={meshRef}
            position={[0, 0, 0]}
            args={[
                geometry,
                sticky_material,
                count
            ]}
        />
    )
}


// -- UI WRAPPER ---
type TerrainScatterUIProps = TerrainScatterProps & {
    showControls?: boolean
}

export function TerrainScatterUI({
    showControls = true,
    ...props
}: TerrainScatterUIProps) {

    if (!showControls) {
        return <TerrainScatter {...props} />
    }

    const controls = useControls("Terrain", {
        Scatter: folder({
            gridSize: {
                value: props.gridSize ?? 50,
                min: 1,
                max: 1000,
                step: 1
            },

            spacing: {
                value: props.spacing ?? 5,
                min: 0.1,
                max: 10,
                step: 0.1
            },
            rotation_random: {
                value: props.rotation_random ?? 0,
                min: 0.0,
                max: 1.0,
                step: 0.01
            },
            scale: {
                value: props.scale ?? 1,
                min: 0.01,
                max: 10,
                step: 0.01
            },
            scale_random: {
                value: props.scale_random ?? 0,
                min: 0.0,
                max: 1.0,
                step: 0.01
            }
        }, { collapsed: true })
    })

    return <TerrainScatter {...props} {...controls} />
}


export const SnappedRelativePosition = Fn(
    ([instanceCenter, objCenter, zone_size]: [Node, Node, Node]) => {
        // relative position to the object center, ignoring Y
        const rel_pos = instanceCenter.sub(objCenter).setY(float(0));
        // modulo for snapping within zone size
        return mod(rel_pos.add(zone_size.div(2.0)), zone_size).sub(zone_size.div(2.0));
    }
);