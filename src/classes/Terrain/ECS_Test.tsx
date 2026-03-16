
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three"
import { createInstanceTransforms, type TerrainScatterProps } from "./TerrainScatter";
import { useTerrainScatterControls } from "./Scatter/ScatterUI";
import { deltaTime, Fn, instanceIndex, int, normalLocal, positionLocal, storage, transformNormalToView, vec3, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial, StorageInstancedBufferAttribute } from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";




export function ECS_Test(_props: TerrainScatterProps) {
    // Mesh Ref
    const meshRef = useRef<THREE.InstancedMesh>(null!)
    const meshRefCompute = useRef<THREE.InstancedMesh>(null!)
    // Read Controls
    const props = useTerrainScatterControls(_props)
    const count = props.gridSize * props.gridSize
    // Create Transofrms
    const instanceTransforms = useMemo(() => {
        return createInstanceTransforms(props)
    }, [props])


    // Create WEBGPU trasnforms_buffer
    const storageAttribute = useMemo(() => {
        return new StorageInstancedBufferAttribute(instanceTransforms, 16)
    }, [instanceTransforms])

    const transformsBuffer = useMemo(() => {
        return storage(storageAttribute)
    }, [storageAttribute])
    // 
    const instanceMatrix = useMemo(() => {
        return transformsBuffer.element(instanceIndex)
    }, [transformsBuffer])



    // Init Matricies for InstancedMesh
    useLayoutEffect(() => {
        const mesh = meshRef.current!;
        const matrix = new THREE.Matrix4();

        for (let i = 0; i < count; i++) {
            matrix.fromArray(instanceTransforms, i * 16);
            mesh.setMatrixAt(i, matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
    }, [instanceTransforms]);

    const vel = new THREE.Vector3(1, 0, 0);

    // Update Matricies for Instanced Mesh
    useFrame((_, delta) => {
        return;
        const start = performance.now();

        const mesh = meshRef.current!;
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scaleVec = new THREE.Vector3();
        //console.log("move instances", mesh.instanceMatrix.count);

        for (let i = 0; i < mesh.instanceMatrix.count; i++) {
            mesh.getMatrixAt(i, matrix);
            matrix.decompose(pos, quat, scaleVec);
            pos.addScaledVector(vel, delta);
            matrix.compose(pos, quat, scaleVec);
            mesh.setMatrixAt(i, matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;

        const end = performance.now();
        //console.log("Instnce Tranform time:", (end - start).toFixed(3), "ms");
    })

    useFrame(async () => {
        return;
        const start = performance.now();
        const mesh = meshRef.current!;
        const readStorageBackToCPU = new Float32Array(await renderer.getArrayBufferAsync(storageAttribute));
        const matrix = new THREE.Matrix4();        

        for (let i = 0; i < mesh.instanceMatrix.count; i++) {
            matrix.fromArray(readStorageBackToCPU, i * 16);
            mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        const end = performance.now();
        console.log("Readback time:", (end - start).toFixed(3), "ms");

    })


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
        const start = performance.now();

        if (!props.visible) return;
        renderer.compute(computeUpdate)

        const end = performance.now();
        console.log("Instnce Tranform time:", (end - start).toFixed(3), "ms");
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

            <instancedMesh ref={meshRef} args={[geometry, undefined, count]}        >
                <meshStandardMaterial vertexColors />
            </instancedMesh>


            <instancedMesh ref={meshRefCompute} args={[geometry, compute_mat, count]} position={[0, 5, 0]} />

        </>
    )
}