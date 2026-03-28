import { useControls, folder } from "leva";
import type { TerrainProps } from "./TerrainProvider";



type TerrainControlsResolved =
    TerrainProps &
    Required<Pick<TerrainProps, "hf_size" | "hf_height" | "color">>;

const TerrainControlsDefaults: TerrainProps = {
    textureUrl:"",
    hf_size: 512,
    hf_height: 25,
    showUI: true,
    color:"#668c81",
};

export function useTerrainControlsUI(
    _props: TerrainProps
): TerrainControlsResolved {

    const props = { ...TerrainControlsDefaults, ..._props };

    if (!props.showUI) return props as TerrainControlsResolved;

    const controlled = useControls("Terrain", {
        "Heightfield": folder({
            hf_size: {
                value: props.hf_size as number,
                min: 1,
                max: 5000,
                step: 1
            },
            hf_height: {
                value: props.hf_height as number,
                min: 0,
                max: 500,
                step: 1
            },
            color: { value: props.color as string}
        }, { collapsed: true })
    });

    return { ...props, ...controlled };
}