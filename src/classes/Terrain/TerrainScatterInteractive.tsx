import * as THREE from "three"
import { useRef, useLayoutEffect } from "react"
import { useTerrain } from "./TerrainProvider"
import { useFrame } from "@react-three/fiber"
import { usePlayer } from "../Player/PlayerContext"

export function TerrainScatterCompute({ count = 100, size = 200 }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!)
    const dummy = new THREE.Object3D()

    const yellow = new THREE.Color("yellow")
    const green = new THREE.Color("green")

    const terrain = useTerrain()
    const { player } = usePlayer()

    // store positions and scales to make updates easier
    const instanceData = useRef(
        Array.from({ length: count }, () => ({
            position: new THREE.Vector3(),
            scale: Math.random() + 0.5,
            rotation: new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            )
        }))
    )

    useLayoutEffect(() => {
        const mesh = meshRef.current
        const colors = new Float32Array(count * 3)

        instanceData.current.forEach((data, i) => {
            // random initial position within size cube
            data.position.set(
                (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * size
            )

            // clamp to terrain
            const height = terrain.getHeightAtPos(data.position)
            data.position.setY(height)
            data.scale = 1;

            // set dummy
            dummy.position.copy(data.position)
            dummy.rotation.copy(data.rotation)
            dummy.scale.setScalar(data.scale)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)

            // default color
            yellow.toArray(colors, i * 3)
        })

        mesh.instanceMatrix.needsUpdate = true
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    }, [count, size])

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
        if (!meshRef.current || !player) return
        const mesh = meshRef.current

        instanceData.current.forEach((data, i) => {
            // check distance from player
            const dx = data.position.x - player.position.x
            const dy = data.position.y - player.position.y
            const dz = data.position.z - player.position.z

            const halfSize = size * 0.5

            // wrap in x
            if (dx > halfSize) data.position.x -= size
            else if (dx < -halfSize) data.position.x += size

            // wrap in y
            if (dy > halfSize) data.position.y -= size
            else if (dy < -halfSize) data.position.y += size

            // wrap in z
            if (dz > halfSize) data.position.z -= size
            else if (dz < -halfSize) data.position.z += size

            // clamp to terrain height again
            const height = terrain.getHeightAtPos(data.position)
            data.position.setY(height)

            // update instance matrix
            dummy.position.copy(data.position)
            dummy.rotation.copy(data.rotation)
            dummy.scale.setScalar(data.scale)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
        })

        mesh.instanceMatrix.needsUpdate = true
    })

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