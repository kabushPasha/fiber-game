import { useCallback, useEffect, useMemo } from "react";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { ao } from "three/examples/jsm/tsl/display/GTAONode.js";
import { useThree } from "@react-three/fiber";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import type { PerspectiveCamera } from "three";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";
import { folder, useControls } from "leva";
import { float, uniform } from "three/tsl";

export function PP_Ao() {
    const pp = useWebGPUPostProcessing();
    const controls = useControls("Render", {
        PostProcess: folder({
            AO: folder({
                enabled: false,
            })
        })
    });


    const { camera } = useThree()

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !pp.scenePass || !controls.enabled || !pp.prePassData) return inputNode;

        const ao_pass = ao(pp.prePassData.prePassDepth, pp.prePassData.prePassNormal, camera);

        return float(0.5).mix(
            inputNode.mul(ao_pass.x),
            inputNode);
    }, [pp, controls.enabled, camera]);

    PostProcessingEffect(effect);
    return null;
}


export function PP_SSGI() {
    const pp = useWebGPUPostProcessing();

    const controls = useControls("Render", {
        PostProcess: folder({
            SSGI: folder({
                enabled: true,
                intensity: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
                gi_intensity: { value: 10, min: 0.0, max: 20.0, step: 0.01 },
            })
        })
    });

    const uniforms = useMemo(() => ({
        intensity: uniform(float(controls.intensity)),
    }), []);

    useEffect(() => {
        uniforms.intensity.value = controls.intensity;
    }, [controls.intensity]);


    const { camera } = useThree()

    const giPass = useMemo(() => {
        if (!pp.scenePass || !controls.enabled || !pp.prePassData) return null;

        const giPass = ssgi(
            pp.scenePass.getTextureNode('output'),
            pp.prePassData.prePassDepth,
            pp.prePassData.prePassNormal,
            camera as PerspectiveCamera);
        giPass.sliceCount.value = 1;
        giPass.stepCount.value = 8;
        giPass.radius.value = 25;
        giPass.giIntensity.value = 10;
        giPass.useTemporalFiltering = true;

        return giPass;
    }, [pp])

    useEffect(() => {
        if (giPass) {
            giPass.giIntensity.value = controls.gi_intensity;
        }

    }, [controls.gi_intensity, giPass])


    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !pp.scenePass || !controls.enabled || !pp.prePassData || !giPass) return inputNode;

        const traaPass = traa(giPass, pp.prePassData.prePassDepth, pp.prePassData.prePassVelocity, camera);

        return traaPass.add(inputNode.mul(uniforms.intensity));

    }, [pp, controls.enabled, uniforms, camera, giPass]);

    PostProcessingEffect(effect);
    return null;
}
