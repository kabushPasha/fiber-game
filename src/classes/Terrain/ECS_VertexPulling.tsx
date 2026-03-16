
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three"
import { createInstanceTransforms, type TerrainScatterProps } from "./TerrainScatter";
import { useTerrainScatterControls } from "./Scatter/ScatterUI";
import { deltaTime, Fn, instanceIndex, int, normalLocal, positionLocal, storage, transformNormalToView, vec3, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial, StorageInstancedBufferAttribute } from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";




export function ECS_VertexPulling(_props: TerrainScatterProps) {
    // Mesh Ref
    const meshRef = useRef<THREE.InstancedMesh>(null!)    
    // Read Controls
    const props = useTerrainScatterControls(_props)
    const count = props.gridSize * props.gridSize
    // Create Transofrms
    const instanceTransforms = useMemo(() => {
        return createInstanceTransforms(props)
    }, [props])


    // Create WEBGPU trasnforms_buffer
    const transformsBuffer = useMemo(() => {
        return storage(new StorageInstancedBufferAttribute(instanceTransforms, 16))
    }, [instanceTransforms])
    // 
    const instanceMatrix = useMemo(() => {
        return transformsBuffer.element(instanceIndex)
    }, [transformsBuffer])


    // update Fn
    const computeUpdate = useMemo(() => {
        return Fn(() => {
            const offset = instanceMatrix.element(int(3));
            offset.assign(offset.addAssign(vec3(deltaTime, 0, 0)));
        })().compute(count);
    }, [instanceMatrix, count]);

    // Get Renderer
    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    useFrame(() => {
        //const start = performance.now();

        if (!props.visible) return;
        renderer.compute(computeUpdate)

        //const end = performance.now();
        //console.log("Instnce Tranform time:", (end - start).toFixed(3), "ms");
    })


    // Compute Material
    const compute_mat = useMemo(() => {
        const mat = new MeshStandardNodeMaterial()
        mat.positionNode = transformsBuffer.element(instanceIndex).mul(positionLocal)
        const normalWorld = transformsBuffer.element(instanceIndex).mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

        return mat
    }, [transformsBuffer])


    // Simple Box For Debug
    const geometry = useMemo(() => {
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