

// useTerrainScatterControls.ts
import { folder, useControls } from "leva"
import type { TerrainScatterProps } from "../TerrainScatter"

// -- UI WRAPPER ---
type TerrainScatterUIProps = TerrainScatterProps & {
    showControls?: boolean
}

export function useTerrainScatterControls(props: TerrainScatterUIProps) {
    return useControls("Terrain", {
        [props.name ?? "Scatter"]: folder({
            gridSize: { value: props.gridSize ?? 5, min: 1, max: 1000, step: 1 },
            spacing: { value: props.spacing ?? 5, min: 0.1, max: 100, step: 0.1 },
            rotation_random: { value: props.rotation_random ?? 0, min: 0, max: 1, step: 0.01 },
            scale: { value: props.scale ?? 1, min: 0.01, max: 10, step: 0.01 },
            scale_random: { value: props.scale_random ?? 0, min: 0, max: 1, step: 0.01 },
            offset_random: { value: props.offset_random ?? 0, min: 0, max: 1, step: 0.01 }
        }, { collapsed: true })
    })
}


export function ScatterUIWrapper<ComponentProps extends TerrainScatterUIProps>(
    Component: React.ComponentType<TerrainScatterUIProps>
) {
    return function Wrapper({ showControls = true, ...props }: ComponentProps & { showControls?: boolean }) {

        if (!showControls) return <Component {...(props as ComponentProps)} />

        const controls = useTerrainScatterControls(props)

        return <Component {...(props as ComponentProps)} {...controls} />
    }
}