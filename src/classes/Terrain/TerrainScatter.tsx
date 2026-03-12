import { useGLTF } from "@react-three/drei"
import { useRef, useMemo } from "react"
import * as THREE from "three"
import {
    attribute,
    float,
    instanceIndex,
    length,
    mix,
    mod,
    modelWorldMatrix,
    modelWorldMatrixInverse,
    normalLocal,
    positionLocal,
    storage,
    texture,
    transformNormalToView,
    uv,
    vec2,
    vec3,
    vec4
} from "three/tsl"
import { MeshStandardNodeMaterial, StorageInstancedBufferAttribute } from "three/webgpu"
import { useTerrain } from "./TerrainProvider"
import { folder, useControls } from "leva"

export type TerrainScatterProps = {
    gridSize?: number
    spacing?: number
}


export function TerrainScatter({
    gridSize = 5,
    spacing = 1
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
                dummy.rotation.y = Math.random() * Math.PI * 2

                // slight scale variation
                //const s = 2 + Math.random() * 2.0
                //dummy.scale.set(s, s, s)

                dummy.updateMatrix()
                dummy.matrix.toArray(transforms, index * 16)
                index++
            }
        }

        return transforms
    }, [gridSize, spacing])

    const { hf_size, hf_tex, hf_height, hf_nml } = useTerrain()

    // Create material after mesh exists
    const sticky_material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.side = THREE.DoubleSide

        // Positions
        const transformsStorage = storage(new StorageInstancedBufferAttribute(instanceTransforms, 16))
        const instanceMatrix = transformsStorage.element(instanceIndex)

        const objCenter = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).setY(float(0.0));

        // Calc snapped Position
        const instanceCenter = instanceMatrix.mul(vec4(0, 0, 0, 1))
        const rel_pos = instanceCenter.sub(objCenter).setY(float(0));
        const mod_rel_pos = mod(rel_pos.add(zone_size / 2.0), zone_size).sub(zone_size / 2.0)
        const snap_offset = mod_rel_pos.add(objCenter).sub(instanceCenter);

        // Sample Height
        //const samplePos = instanceCenter.add(snap_offset).div(hf_size).add(-0.5).zx.mul(vec2(1, -1));
        const samplePos = instanceMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).add(snap_offset).div(hf_size).add(-0.5).zx.mul(vec2(1, -1));
        const heightSample = texture(hf_tex, samplePos).x.mul(hf_height).add(0.001);

        const distance_sacle = length(mod_rel_pos).sub(0).div(zone_size * 0.5).oneMinus().clamp(0, 1).pow(1)
        //const scaled_localPos = positionLocal.mul(vec3(1, distance_sacle, 1))
        // Scale to root 
        const scaled_localPos = mix(positionLocal, vec3(0.0), distance_sacle.oneMinus());

        const out_local_pos = scaled_localPos;
        const instancePos = instanceMatrix.mul(vec4(out_local_pos, 1))
        const final_pos = instancePos.add(snap_offset.setY(heightSample));


        // Final Position
        mat.positionNode = modelWorldMatrixInverse.mul(final_pos).xyz;

        // Normal
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

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
            }
        }, { collapsed: true })
    })

    return <TerrainScatter {...props} {...controls} />
}