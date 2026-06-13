import { uniform, vec3 } from "three/tsl";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { folder, useControls } from "leva";


type PP_RimLightProps = {
    enabled?: boolean;
    amp?: number;
    power?: number;
};


export function PP_RimLight({
    enabled = true,
    amp = 0.70,
    power = 1.5,
}: PP_RimLightProps
) {
    const { scenePass } = useWebGPUPostProcessing();

    // ------------------ Controls ------------------
    const [controls, set, ] = useControls(() => ({
        Render: folder({
            PostProcess: folder({
                RimLight: folder({
                    enabled: enabled,
                    amp: { value: amp, min: 0.0, max: 1, step: 0.01 },
                    power: { value: power, min: 0.0001, max: 20, step: 0.01 },

                })
            })
        })

    }));

    useEffect(() => {
        set({ enabled, amp, power });
    }, [enabled, amp, power, set]);

    const uniforms = useMemo(() => ({
        power: uniform(controls.power),
        amp: uniform(controls.amp),
    }), []);

    useEffect(() => {
        uniforms.power.value = controls.power;
        uniforms.amp.value = controls.amp;
    }, [controls.power, controls.amp]);

    // ------------------ Effect ------------------
    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !controls.enabled || !scenePass) return inputNode;

        return scenePass.getTextureNode("normal").normalize().dot(vec3(0, 0, -1)).oneMinus().clamp(0, 1).pow(uniforms.power).oneMinus().mul(uniforms.amp).mix(inputNode, vec3(0));

    }, [controls.enabled, scenePass, uniforms]);


    PostProcessingEffect(effect);

    return null;
}
