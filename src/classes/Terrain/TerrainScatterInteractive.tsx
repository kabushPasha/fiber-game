import * as THREE from "three"
import { useRef, useLayoutEffect, useMemo } from "react"
import { useTerrain } from "./TerrainProvider"
import {  useFrame } from "@react-three/fiber"
import { usePlayer } from "../Player/PlayerContext"
import { createInstanceTransforms, type TerrainScatterProps } from "./TerrainScatter"
import { ScatterUIWrapper } from "./Scatter/ScatterUI"

export function TerrainScatterInteractive({
    gridSize = 10,
    spacing = 10,
    rotation_random = 1,
    scale = 1,
    scale_random = 0.3,
    offset_random = 0.5,
}: TerrainScatterProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!)
    const dummy = new THREE.Object3D()

    const yellow = new THREE.Color("yellow")
    const green = new THREE.Color("green")

    const terrain = useTerrain()
    const { player } = usePlayer()

    const count = useMemo(() => { return gridSize * gridSize }, [gridSize])

    // keep a ref for mutable instance data
    const instanceDataRef = useRef<{
        position: THREE.Vector3;
        scale: number;
        rotation: THREE.Euler;
    }[]>([]);
    const colorsRef = useRef<Float32Array | null>(null)

    // recreate instanceData whenever gridSize changes
    useLayoutEffect(() => {
        const mesh = meshRef.current!;
        const count = gridSize * gridSize;
        const transforms = createInstanceTransforms({ gridSize, spacing, scale, scale_random, rotation_random, offset_random });

        instanceDataRef.current = Array.from({ length: count }, () => ({
            position: new THREE.Vector3(),
            scale: 1,
            rotation: new THREE.Euler(),
        }));

        // Initialize colors buffer (reuse if exists)
        if (!colorsRef.current || colorsRef.current.length !== count * 3) {
            colorsRef.current = new Float32Array(count * 3)
        }
        const colors = colorsRef.current
        const dummy = new THREE.Object3D();
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scaleVec = new THREE.Vector3();
        const matrix = new THREE.Matrix4();

        for (let i = 0; i < count; i++) {
            matrix.fromArray(transforms, i * 16);
            matrix.decompose(pos, quat, scaleVec);

            const data = instanceDataRef.current[i];
            data.position.copy(pos);
            data.rotation.setFromQuaternion(quat);
            data.scale = scaleVec.x;

            const height = terrain.getHeightAtPos(data.position);
            data.position.y = height;

            dummy.position.copy(data.position);
            dummy.rotation.copy(data.rotation);
            dummy.scale.setScalar(data.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            yellow.toArray(colors, i * 3);
        }

        mesh.instanceMatrix.needsUpdate = true;
        // Only set instanceColor once, never replace it
        if (!mesh.instanceColor) {
            mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
        } else {
            mesh.instanceColor.array = colors
            mesh.instanceColor.needsUpdate = true
        }

        meshRef.current.computeBoundingSphere();
        meshRef.current.computeBoundingBox();

    }, [gridSize, spacing, scale, scale_random, rotation_random, offset_random, terrain]);

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

    useFrame(() => {
        if (!meshRef.current || !player) return;
        //const start = performance.now(); // start timing

        const mesh = meshRef.current;
        const zoneSize = gridSize * spacing;
        const halfSize = zoneSize / 2;

        instanceDataRef.current.forEach((data, i) => {
            let dx = data.position.x - player.position.x;
            let dz = data.position.z - player.position.z;

            if (dx > halfSize) data.position.x -= zoneSize;
            else if (dx < -halfSize) data.position.x += zoneSize;

            if (dz > halfSize) data.position.z -= zoneSize;
            else if (dz < -halfSize) data.position.z += zoneSize;

            // Y based on terrain
            const height = terrain.getHeightAtPos(data.position);
            data.position.y = height;

            dummy.position.copy(data.position);
            dummy.rotation.copy(data.rotation);
            dummy.scale.setScalar(data.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
        meshRef.current.computeBoundingBox();

    });

    return (
        <instancedMesh
            frustumCulled={false}
            ref={meshRef}
            args={[undefined, undefined, count]}
            onPointerOver={handleOver}
            onPointerOut={handleOut}
            castShadow
        >
            <boxGeometry />
            <meshStandardMaterial vertexColors />
        </instancedMesh>
    )
}

export const TerrainScatterInteractiveUI = ScatterUIWrapper(TerrainScatterInteractive)