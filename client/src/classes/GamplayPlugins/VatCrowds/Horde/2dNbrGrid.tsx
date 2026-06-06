import { useEffect} from "react"
import { usePlayer } from "../../../Player/PlayerContext"
import { NeighbourGrid2D } from "../../../Terrain/ECS/NbrGrid2D"
import { atomicLoad, float, If, instanceIndex, int, ivec2,  vec3, vec4 } from "three/tsl"
import { Fn } from "three/src/nodes/TSL.js"
import * as THREE from "three/webgpu";

/*
type NgbGridCollideProps = {
    size?: number
    cells?: number
    max_nbrs?: number
    radius?: number
    strength?: number
    show_debug_mesh?: boolean
    follow_player?: boolean
}

export function NgbGrid_Collide2D({
    size = 100,
    cells = 20,
    max_nbrs = 16 * 2,
    radius = 2.0,
    strength = 0.2,
    show_debug_mesh = false,
    follow_player = true,
}: NgbGridCollideProps) {
    const [controls, set] = useControls(() => ({
        NBR_Grid: folder({
            size: { value: size, min: 10, max: 500, step: 5.0 },
            cells: { value: cells, min: 1, max: 256, step: 1 },
            max_nbrs: { value: max_nbrs, min: 1, max: 512, step: 1 },
            show_debug_mesh: show_debug_mesh,
            follow_player: follow_player,
            Physics: folder({
                radius: { value: radius, min: 0.1, max: 10.0, step: 0.1 },
                strength: { value: strength, min: 0.0, max: 5.0, step: 0.01 },
            }),
        })
    }));

    useEffect(() => {
        set({ size, cells, max_nbrs, radius, strength, show_debug_mesh, follow_player, });
    }, [size, cells, max_nbrs, radius, strength, show_debug_mesh, follow_player, set]);

    const renderer = useWebGPURenderer();
    const horde = useHorde();
    const player = usePlayer();

    const nbr_grid = useMemo(() => {
        return new NeighbourGrid2D(
            controls.size,
            controls.cells,
            controls.max_nbrs
        )
    }, [controls.size, controls.cells, controls.max_nbrs])

    const uniforms = useMemo(
        () => ({
            radius: uniform(float(2.0)),
            strength: uniform(float(0.2)),
        }),
        []
    );
    useEffect(() => {
        uniforms.radius.value = controls.radius;
        uniforms.strength.value = controls.strength;
    }, [controls.radius, controls.strength])


    // Write Particle to grid
    const fillGridCompute = useMemo(() => {
        return Fn(() => {
            If(instanceIndex.lessThan(horde.pos_buffer.count), () => {
                const offset = horde.pos_buffer.element;
                nbr_grid.insertParticle(offset, instanceIndex)
            })
        })().compute(horde.pos_buffer.count);
    }, [nbr_grid, horde])

    // Compute PBD    
    const pbdCompute = useMemo(() => {
        return pbdRepelCompute(
            horde.pos_buffer.bufferNode,
            nbr_grid,
            horde.pos_buffer.count,
            uniforms.radius,
            uniforms.strength
        ).compute(horde.pos_buffer.count);
    }, [nbr_grid, horde.pos_buffer, uniforms])
    

    // Follow player
    useEffect(() => {
        if (controls.follow_player) nbr_grid.gridCenterUniform.value = player.playerWorldPosition;
        else nbr_grid.gridCenterUniform.value = new THREE.Vector3(0.0);
    }, [controls.follow_player, player])

    useFrame(async () => {
        await renderer.computeAsync(nbr_grid.clearCompute())
        await renderer.computeAsync(fillGridCompute)
        await renderer.computeAsync(nbr_grid.computeMirror())
        await renderer.computeAsync(pbdCompute)
    })

    if (!controls.show_debug_mesh) return null
    return (
        <primitive object={nbr_grid.createDebugMesh()} />
    )
}

*/

export const pbdRepelCompute = Fn((
    [posBuffer, grid, count, radius, strength]: [THREE.StorageBufferNode, NeighbourGrid2D, THREE.UniformNode<number>, number, number]
) => {
    If(instanceIndex.lessThan(count), () => {
        const pos = posBuffer.element(instanceIndex)        

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
                        const otherPos = posBuffer.element(otherIndex)

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
        pos.addAssign(vec4(correction, 0.0))
    })
})




export function NbrGridFollowPlayer({nbr_grid}:{nbr_grid:NeighbourGrid2D}) {
    const player = usePlayer();
    useEffect(() => {
        nbr_grid.gridCenterUniform.value = player.playerWorldPosition;        
    }, [player])
    return null;
}