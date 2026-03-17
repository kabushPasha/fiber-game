
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three"

import { deltaTime, Fn, If, instanceIndex, int, normalLocal, positionLocal, storage, transformNormalToView, vec3, vec4, greaterThanEqual, Return, vec2, float, sin, time, atomicLoad, uniform, greaterThan, lessThan, cos, Loop, Break, ivec2 } from "three/tsl";
import { MeshStandardNodeMaterial, StorageArrayElementNode, StorageBufferAttribute, StorageBufferNode, StorageInstancedBufferAttribute, UniformNode } from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { createInstanceTransforms, type TerrainScatterProps } from "../TerrainScatter";
import { useTerrainScatterControls } from "../Scatter/ScatterUI";
import { NeighbourGrid2D } from "./NbrGrid2D";




export function ECS_NBRGrid(_props: TerrainScatterProps) {
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

    const prevTransformsBuffer = useMemo(() => {
        return storage(new StorageInstancedBufferAttribute(count, 16))
    }, [count])

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


    // update Fn
    const computeUpdate = useMemo(() => {
        return Fn(() => {
            const offset = instanceMatrix.element(int(3));
            offset.assign(offset.addAssign(vec3(deltaTime.mul(1), 0, 0)));
        })().compute(count);
    }, [instanceMatrix, count]);

    // Get Renderer
    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    useFrame(() => {
        //const start = performance.now();

        if (!props.visible) return;
        //renderer.compute(computeUpdate)

        //setCount(count+1);

        //const end = performance.now();
        //console.log("Instnce Tranform time:", (end - start).toFixed(3), "ms");
    })


    // Compute Material
    const compute_mat = useMemo(() => {
        console.log("Create compute_mat")
        const mat = new MeshStandardNodeMaterial()
        mat.positionNode = transformsBuffer.element(instanceIndex).mul(positionLocal)
        const normalWorld = transformsBuffer.element(instanceIndex).mul(vec4(normalLocal, 0)).xyz
        mat.normalNode = transformNormalToView(normalWorld)

        return mat
    }, [transformsBuffer])


    // Simple Box For Debug
    const geometry = useMemo(() => {
        console.log("Create geometry")
        return new THREE.SphereGeometry(1);
        const g = new THREE.BoxGeometry(1, 1, 1)
        g.translate(0, 0.5, 0)
        return g
    }, [])


    // NBR GRID --------------------------------------
    const grid = useMemo(() => {
        console.log("CREATE NBR_Grid")
        return new NeighbourGrid2D(200, 20, 16)
    }, [])

    const uniforms = useMemo(
        () => ({
            active_count: uniform(1),
        }),
        []
    );

    const fillGridCompute = useMemo(() => {
        //return grid.fillGridCompute(instanceMatrix, count)        
        console.log("Create fillGridCompute")
        return Fn(() => {
            If(instanceIndex.lessThan(uniforms.active_count), () => {
                const offset = instanceMatrix.element(int(3))
                grid.insertParticle(offset, instanceIndex)
            })
        })().compute(count)

    }, [grid, instanceMatrix, count, uniforms])

    const storePrevTransforms = useMemo(() => {
        return Fn(() => {
            prevTransformsBuffer.element(instanceIndex).assign(instanceMatrix)
        })().compute(count)
    }, [prevTransformsBuffer, instanceMatrix, count])


    const pbdComputeFn = useMemo(() => {
        console.log("Create pbdComputeFn")
        return pbdRepelCompute(transformsBuffer, grid, uniforms.active_count,2,0.2 )
    }, [grid, transformsBuffer, uniforms])

    const pbdCompute = useMemo(() => {
        console.log("CREATE pbdCompute")
        return pbdComputeFn.compute(count)
    }, [pbdComputeFn, count])

    useFrame(async () => {
        if (clicked) {
            meshRef.current.count += 1000;
            uniforms.active_count.value = meshRef.current.count;
            setClicked(false);
        }

        renderer.computeAsync(grid.clearCompute())
        renderer.computeAsync(fillGridCompute)
        //await renderer.computeAsync(storePrevTransforms)

        renderer.computeAsync(grid.computeMirror())
        renderer.computeAsync(pbdCompute)
        renderer.computeAsync(pbdCompute)
        renderer.computeAsync(pbdCompute)
        renderer.computeAsync(pbdCompute)


        // Read Buffer For Test
        //const buffer = await renderer.getArrayBufferAsync(grid.gridCounts.value)
        //const readStorageBackToCPU = new Uint32Array(buffer)
        //console.log(readStorageBackToCPU);
    })


    const [clicked, setClicked] = useState(false)

    // Spawn On Click
    useEffect(() => {
        console.log("CREATE handleClick")
        const handleClick = (event: MouseEvent) => {
            if (!clicked) setClicked(true);
        };
        gl.domElement.addEventListener("click", handleClick);
        return () => gl.domElement.removeEventListener("click", handleClick);
    }, [gl]);

    return (
        <>
            <instancedMesh ref={meshRef} args={[geometry, compute_mat, 1]} position={[0, 5, 0]} />
            <primitive object={grid.createDebugMesh()} />
        </>
    )
}



const pbdRepelCompute = Fn((
    [transformsBuffer, grid, active_count, radius, strength]: [StorageBufferNode, NeighbourGrid2D, UniformNode<number>, number, number]
) => {
    If(instanceIndex.lessThan(active_count), () => {
        const self = transformsBuffer.element(instanceIndex)
        const pos = self.element(int(3))

        const cell2 = grid.posToIndex2TSL(pos)
        const correction = vec3(0).toVar("OffsetCorrection")

        const size = 1;

        for (let oy = -size; oy <= size; oy++) {
            for (let ox = -size; ox <= size; ox++) {

                const neighborCell2 = cell2.add(ivec2(ox, oy));
                const linear = grid.index2ToLinearTSL(neighborCell2)
                const base = grid.getCellBaseIndex(linear)

                // iterate fixed max per cell
                const countInCell = atomicLoad(grid.gridCounts.element(linear))
                for (let i = 0; i < grid.maxPerCell; i++) {
                    If(int(i).lessThan(countInCell), () => {
                        const otherIndex = grid.gridParticles.element(base.add(int(i)))
                        const otherMatrix = transformsBuffer.element(otherIndex)
                        const otherPos = otherMatrix.element(int(3))

                        const dir = pos.xyz.sub(otherPos.xyz).mul(vec3(1, 0, 1))
                        const dist = dir.length()

                        If(otherIndex.notEqual(instanceIndex), () => {

                            If(dist.lessThan(float(radius)), () => {
                                const push = dir.normalize()
                                    .mul(float(radius).sub(dist))
                                    .mul(strength)
                                correction.addAssign(push)
                            })
                        })
                    })
                }
            }
        }

        // apply correction
        const offset = self.element(int(3))
        offset.addAssign(vec4(correction, 0.0))
    })
})


