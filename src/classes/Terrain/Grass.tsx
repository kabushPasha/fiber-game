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

export function Grass() {
    const { nodes } = useGLTF("models/Grass.glb")
    const meshRef = useRef<THREE.InstancedMesh>(null!)

    const gridSize = 50
    const spacing = 2
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
                const s = 2 + Math.random() * 2.0
                dummy.scale.set(s, s, s)

                dummy.updateMatrix()
                dummy.matrix.toArray(transforms, index * 16)
                index++
            }
        }

        return transforms
    }, [gridSize, spacing])

    const { hf_size, hf_tex, hf_height, hf_nml } = useTerrain()

    // Create material after mesh exists    
    //@ts-ignore
    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.side = THREE.DoubleSide

        // Create storage buffer for transforms
        const transformsStorage = storage(new StorageInstancedBufferAttribute(instanceTransforms, 16))

        const instanceMatrix = transformsStorage.element(instanceIndex)
        //const worldCenter = modelWorldMatrix.mul(instanceMatrix.mul( vec4(0,0,0,1)));
        //const sampleUV = worldCenter.div(hf_size).add(-0.5).zx.mul(vec2(1, -1))

        const localCenter = instanceMatrix.mul(vec4(0, 0, 0, 1));
        const worldCenter = modelWorldMatrix.mul(localCenter);
        const sampleUV = worldCenter.div(hf_size).add(-0.5).zx.mul(vec2(1, -1))


        mat.positionNode = (() => {
            const worldPos = instanceMatrix.mul(vec4(positionLocal, 1))
            const heightSample = texture(hf_tex, sampleUV).x
            return worldPos.add(vec3(0, heightSample.mul(hf_height).add(0.01).sub(worldCenter.y), 0)).xyz
        })()


        mat.colorNode = vec3(0.3, 0.9, 0.6);

        const normalMap = texture(hf_nml, sampleUV);
        mat.normalNode = transformNormalToView(normalMap.mul(2.0).sub(1.0).xzy)

        //mat.colorNode = normalMap;

        return mat
    }, [instanceTransforms, hf_size, hf_tex, hf_height])


    // Create material after mesh exists
    const sticky_material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.side = THREE.DoubleSide

        // Positions
        const transformsStorage = storage(new StorageInstancedBufferAttribute(instanceTransforms, 16))
        const instanceMatrix = transformsStorage.element(instanceIndex)

        const objCenter = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).setY(float(0.0));
        // Blade Root Center
        const root_pos = attribute("uv1", "vec2");
        const blade_root_center = vec3(root_pos.x, 0, root_pos.y.oneMinus())

        // Calc snapped Position
        const instanceCenter = instanceMatrix.mul(vec4(0, 0, 0, 1))
        const rel_pos = instanceCenter.sub(objCenter).setY(float(0));
        const mod_rel_pos = mod(rel_pos.add(zone_size / 2.0), zone_size).sub(zone_size / 2.0)
        const snap_offset = mod_rel_pos.add(objCenter).sub(instanceCenter);

        // Sample Height
        //const samplePos = instanceCenter.add(snap_offset).div(hf_size).add(-0.5).zx.mul(vec2(1, -1));
        const samplePos = instanceMatrix.mul( vec4(blade_root_center,1.0) ).add(snap_offset).div(hf_size).add(-0.5).zx.mul(vec2(1, -1));
        const heightSample = texture(hf_tex, samplePos).x.mul(hf_height).add(0.001);

        const distance_sacle = length(mod_rel_pos).sub(20).div(zone_size).oneMinus().clamp(0, 1).pow(3)
        //const scaled_localPos = positionLocal.mul(vec3(1, distance_sacle, 1))
        // Scale to root 
        const scaled_localPos = mix(positionLocal, blade_root_center, distance_sacle.oneMinus());

        const out_local_pos = scaled_localPos;
        const instancePos = instanceMatrix.mul(vec4(out_local_pos, 1))
        const final_pos = instancePos.add(snap_offset.setY(heightSample));


        // Final Position
        mat.positionNode = modelWorldMatrixInverse.mul(final_pos).xyz;

        // Color
        const base_color = vec3(0.3, 0.9, 0.6)
        const bright_color = vec3(0.9, 2, 0.9)
        const uv_mix = uv().y.pow(0.2).oneMinus();
        const dist_mix = distance_sacle.pow(4.0)

        mat.colorNode = mix(base_color, bright_color, dist_mix.mul(uv_mix));
        //mat.colorNode = base_color;

        // Normal
        const normalMap = texture(hf_nml, samplePos);
        mat.normalNode = transformNormalToView(normalMap.mul(2.0).sub(1.0).xzy)


        return mat
    }, [instanceTransforms, hf_size, hf_tex, hf_height, zone_size])



    return (
        <instancedMesh
            frustumCulled={false}
            ref={meshRef}
            position={[0, 0, 0]}
            args={[
                (nodes.file1 as THREE.Mesh).geometry,
                sticky_material,
                count
            ]}
        />
    )
}