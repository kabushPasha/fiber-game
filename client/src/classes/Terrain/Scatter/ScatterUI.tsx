

// useTerrainScatterControls.ts
import { folder, useControls } from "leva"
import type { TerrainScatterProps } from "../TerrainScatter"

type TerrainScatterResolvedProps =
    TerrainScatterProps &
    Required<Pick<
        TerrainScatterProps,
        "gridSize" |
        "spacing" |
        "rotation_random" |
        "scale" |
        "scale_random" |
        "offset_random"
    >>

const default_scatter_props: TerrainScatterProps = {
    visible : true,
    geometry: null,
    gridSize: 5,
    spacing: 1,
    rotation_random: 0,
    scale: 1,
    scale_random: 0,
    offset_random: 0,
    children: null,
    name: "Scattered",
    showUI: true
};

export function useTerrainScatterControls(_props: TerrainScatterProps):TerrainScatterResolvedProps  {
    const props = { ...default_scatter_props, ..._props };

    if (!props.showUI) return props as TerrainScatterResolvedProps;

    const controlled_props = useControls("Terrain", {
        [props.name as string]: folder({
            visible: { value: props.visible as boolean },
            gridSize: { value: props.gridSize as number, min: 1, max: 1000, step: 1 },
            spacing: { value: props.spacing as number, min: 0.1, max: 100, step: 0.1 },
            rotation_random: { value: props.rotation_random as number, min: 0, max: 1, step: 0.01 },
            scale: { value: props.scale as number, min: 0.01, max: 10, step: 0.01 },
            scale_random: { value: props.scale_random as number, min: 0, max: 1, step: 0.01 },
            offset_random: { value: props.offset_random as number, min: 0, max: 1, step: 0.01 }
        }, { collapsed: true })
    })

    return { ...props, ...controlled_props }
}




