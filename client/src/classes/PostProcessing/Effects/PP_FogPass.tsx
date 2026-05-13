import { useThree } from "@react-three/fiber";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import * as THREE from "three/webgpu";
import { useCallback, useEffect, useMemo } from "react";
import { mix, uniform, vec3 } from "three/tsl";
import { FogNode } from "../Nodes/FogPass";
import { folder, useControls } from "leva";

interface PP_FogPassProps {
    density?: number;
    heightFalloff?: number;
    showUI?: boolean;
    enabled?: boolean;
    color?: string;
}

export function PP_FogPass(props: PP_FogPassProps) {
    const { scenePass } = useWebGPUPostProcessing();
    const { camera } = useThree();

    const { density, heightFalloff, enabled, color } = useFogPassControls(props);

    const uniforms = useMemo(
        () => ({
            density: uniform(density),
            heightFalloff: uniform(heightFalloff),
            color: uniform(vec3(0.3, 0.6, 0.9))
        }),
        []
    );

    const effect = useCallback((inputNode: any) => {
        if (!scenePass) return null;
        if (!enabled) return inputNode;

        //console.log("REGISTER FOG")

        const depth = scenePass.getTextureNode("depth");
        const fog = FogNode(
            depth,
            camera as THREE.PerspectiveCamera,
            uniforms.heightFalloff,
            uniforms.density
        ).mul(1);

        return mix(inputNode, uniforms.color, fog);
        //return fog;

    }, [scenePass, camera, enabled]); // NOT density

    useEffect(() => {
        uniforms.density.value = density;
        uniforms.heightFalloff.value = heightFalloff;
        const c = new THREE.Color(color);
        uniforms.color.value.set(c.r, c.g, c.b);
    }, [density, heightFalloff, color])
    
    PostProcessingEffect(effect);


    return null;
}



export function useFogPassControls(_props: PP_FogPassProps) {
    const props = { density: 0.0025, heightFalloff: 0.01, showUI: true, enabled: true, color: "#9bcaf8", ..._props };

    if (!props.showUI) return props;

    const controlled = useControls("Render", {
        PostProcess: folder({
            fog: folder({
                enabled: true,
                density: { value: props.density, min: 0, max: 0.05, step: 0.0001 },
                heightFalloff: { value: props.heightFalloff, min: 0, max: 0.1, step: 0.001 },
                color: { value: props.color }
            }, { collapsed: true }),
        })
    }
    );

    return { ...props, ...controlled };
}