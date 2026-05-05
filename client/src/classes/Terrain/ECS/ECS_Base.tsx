
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three"

import { instanceIndex, normalLocal, positionLocal, storage, transformNormalToView, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial, StorageInstancedBufferAttribute, } from "three/webgpu";
import { createInstanceTransforms, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";



export function InstanceMesh(_props: TerrainScatterProps) {
    // Mesh Ref
    const meshRef = useRef<THREE.InstancedMesh>(null!)
    // Read Controls
    const props = useTerrainScatterControls(_props)

    const count = useMemo(() => {
        console.log("Init Count")
        return props.gridSize * props.gridSize
    }, [props.gridSize])

    // Create Transofrms        
    const { gridSize, spacing, rotation_random, scale, scale_random, offset_random } = props;
    const instanceTransforms = useMemo(() => {
        console.log("Create Instance Transforms")
        return createInstanceTransforms({ gridSize, spacing, scale, scale_random, rotation_random, offset_random })
    }, [gridSize, spacing, scale, scale_random, rotation_random, offset_random])

    const transformsAtt = useMemo(() => {
        console.log("Create transformsAtt")
        return new StorageInstancedBufferAttribute(instanceTransforms, 16)
    }, [count])

    // Create WEBGPU trasnforms_buffer
    const transformsBuffer = useMemo(() => {
        console.log("Create transformsBuffer")
        return storage(transformsAtt)
    }, [transformsAtt])

    useEffect(() => {
        console.log("Update transformsAtt")
        transformsAtt.array.set(instanceTransforms);
        transformsAtt.needsUpdate = true;
    }, [instanceTransforms])

    // 
    const instanceMatrix = useMemo(() => {
        console.log("Create instanceMatrix")
        return transformsBuffer.element(instanceIndex)
    }, [transformsBuffer])


    // Compute Material
    const compute_mat = useMemo(() => {
        console.log("Create compute_mat")
        const mat = new MeshStandardNodeMaterial()
        mat.positionNode = instanceMatrix.mul(positionLocal)
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

        return mat
    }, [instanceMatrix])


    // Simple Box For Debug
    const geometry = useMemo(() => {
        console.log("Create geometry")
        const g = new THREE.BoxGeometry(1, 1, 1)
        g.translate(0, 0.5, 0)
        return g
    }, [])

    return (
        <>
            <instancedMesh ref={meshRef} args={[geometry, compute_mat, count]} position={[0, 5, 0]} />
        </>
    )
}




