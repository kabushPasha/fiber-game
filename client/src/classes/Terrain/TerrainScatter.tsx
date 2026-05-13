import * as THREE from "three"

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




