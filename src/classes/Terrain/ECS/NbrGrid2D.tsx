import { storage, Fn, instanceIndex, int, normalLocal, vec4, positionLocal, transformNormalToView, vec3, atomicAdd, atomicStore, float, atomicLoad, vec2, If, Return } from "three/tsl"
import { MeshStandardNodeMaterial, Node, StorageBufferAttribute, StorageInstancedBufferAttribute } from "three/webgpu"
import * as THREE from "three"

export class NeighbourGrid2D {
    size: number
    numCells: number
    cellSize: number
    totalCells: number
    maxPerCell: number

    gridCounts
    gridParticles

    cellTransforms
    cellTransformsBuffer

    gridCountsMirror
    debugMaterial

    constructor(size: number, numCells: number, maxPerCell = 16) {
        this.size = size
        this.numCells = numCells
        this.cellSize = size / numCells
        this.totalCells = numCells * numCells
        this.maxPerCell = maxPerCell

        const counts = new Uint32Array(this.totalCells)
        const particles = new Uint32Array(this.totalCells * maxPerCell)

        this.gridCounts = storage(
            new StorageBufferAttribute(counts, 1), 'uint', 1
        ).setPBO(true).toAtomic()


        this.gridParticles = storage(
            new StorageBufferAttribute(particles, 1)
        )

        this.gridCountsMirror = storage(
            new StorageInstancedBufferAttribute(counts, 1)
        )

        this.cellTransforms = this.createCellTransforms()

        this.cellTransformsBuffer = storage(
            new StorageInstancedBufferAttribute(this.cellTransforms, 16)
        )
        this.debugMaterial = this.createDebugMaterial()
    }

    static cellGeometry = (() => {
        const g = new THREE.BoxGeometry(1, 0.05, 1)
        g.translate(0, 0.025, 0)
        return g
    })()

    inGridTSL(pos: Node) {
        const half = float(this.size * 0.5)
        const p = pos.xz

        return p.x.greaterThanEqual(half.negate())
            .and(p.x.lessThan(half))
            .and(p.y.greaterThanEqual(half.negate()))
            .and(p.y.lessThan(half))
    }

    posToIndex2TSL(pos: Node) {
        const half = float(this.size * 0.5)
        return pos.xz.add(vec2(half)).div(this.cellSize).floor()
    }
    index2ToLinearTSL(i: Node) {
        return i.x.add(i.y.mul(this.numCells))
    }

    clearCompute() {
        return Fn(() => {
            //this.gridCounts.element(instanceIndex).assign(int(0))
            atomicStore(this.gridCounts.element(instanceIndex), int(0))
        })().compute(this.totalCells)
    }

    insertParticle(posNode: Node, particleIndexNode: Node) {
        const inGrid = this.inGridTSL(posNode)
        If(inGrid, () => {
            const cell = this.posToIndex2TSL(posNode)
            const linear = this.index2ToLinearTSL(cell)

            const offset = atomicAdd(this.gridCounts.element(linear), 1)
            const writeIndex = linear.mul(this.maxPerCell).add(offset)

            this.gridParticles.element(writeIndex).assign(particleIndexNode)
        })
    }

    createCellTransforms() {
        const transforms = new Float32Array(this.totalCells * 16)

        const half = this.size * 0.5
        const m = new THREE.Matrix4()
        const pos = new THREE.Vector3()
        const scale = new THREE.Vector3(this.cellSize, 1, this.cellSize)
        const quat = new THREE.Quaternion()

        let ptr = 0
        for (let y = 0; y < this.numCells; y++) {
            for (let x = 0; x < this.numCells; x++) {
                pos.set(
                    x * this.cellSize - half + this.cellSize * 0.5,
                    0,
                    y * this.cellSize - half + this.cellSize * 0.5
                )

                m.compose(pos, quat, scale)
                m.toArray(transforms, ptr)
                ptr += 16
            }
        }
        return transforms
    }

    createDebugMaterial() {
        const mat = new MeshStandardNodeMaterial()
        mat.wireframe = true

        const scale = this.gridCountsMirror.element(instanceIndex).mul(40).add(1.0)

        mat.positionNode =
            this.cellTransformsBuffer
                .element(instanceIndex)
                .mul(positionLocal.mul(0.9).mul(vec3(1, scale, 1)))
        return mat
    }

    createDebugMesh() {
        const mesh = new THREE.InstancedMesh(
            NeighbourGrid2D.cellGeometry,
            this.debugMaterial,
            this.totalCells
        )

        // Make it ignore raycasts
        mesh.raycast = () => { }
        return mesh
    }

    computeMirror() {
        return Fn(() => {
            const count = float(atomicLoad(this.gridCounts.element(instanceIndex)))
            this.gridCountsMirror.element(instanceIndex).assign(count)
        })().compute(this.totalCells)
    }

    fillGridCompute(instanceMatrix: Node, count: number) {
        return Fn(() => {
            If(instanceIndex.lessThan(count), () => {
                const offset = instanceMatrix.element(int(3))
                this.insertParticle(offset, instanceIndex)
            })
        })().compute(count)
    }

    getCellBaseIndex(linear: Node) {
        return linear.mul(this.maxPerCell)
    }
}