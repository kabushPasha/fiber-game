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
    start_distance?: number;
}

export function PP_FogPass({
    density = 0.0025,
    heightFalloff = 0.01,
    start_distance = 20,
    enabled = true,
    color = "#9bcaf8"
}: PP_FogPassProps) {
    const { scenePass } = useWebGPUPostProcessing();
    const { camera } = useThree();

    const [controls, set, _] = useControls(() => ({
        Render: folder({
            PostProcess: folder({
                fog: folder({
                    enabled: enabled,
                    density: { value: density, min: 0, max: 0.2, step: 0.0001 },
                    start_distance: { value: start_distance, min: 0, max: 100, step: 0.0001 },
                    heightFalloff: { value: heightFalloff, min: 0, max: 0.1, step: 0.001 },
                    color: { value: color }
                }, { collapsed: true }),
            })
        })
    })
    );

    useEffect(() => {
        set({ density, heightFalloff, start_distance, enabled, color });
    }, [density, heightFalloff, start_distance, enabled, color, set]);

    const uniforms = useMemo(
        () => ({
            density: uniform(controls.density),
            heightFalloff: uniform(controls.heightFalloff),
            color: uniform(vec3(0.3, 0.6, 0.9)),
            start_distance: uniform(controls.start_distance),
        }),
        []
    );

    useEffect(() => {
        uniforms.density.value = controls.density;
        uniforms.heightFalloff.value = controls.heightFalloff;
        const c = new THREE.Color(controls.color);
        uniforms.color.value.set(c.r, c.g, c.b);
        uniforms.start_distance.value = controls.start_distance;
    }, [controls.density, controls.heightFalloff, controls.color, controls.start_distance])


    const effect = useCallback((inputNode: any) => {
        if (!scenePass) return null;
        if (!controls.enabled) return inputNode;

        //console.log("REGISTER FOG")

        const depth = scenePass.getTextureNode("depth");
        const fog = FogNode(
            depth,
            camera as THREE.PerspectiveCamera,
            uniforms.heightFalloff,
            uniforms.density,
            uniforms.start_distance
        ).mul(1);

        return mix(inputNode, uniforms.color, fog);

    }, [scenePass, camera, controls.enabled]); // NOT density



    PostProcessingEffect(effect);


    return null;
}


