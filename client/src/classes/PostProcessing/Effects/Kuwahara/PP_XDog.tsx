import { folder, useControls } from "leva";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three/webgpu"
import { gaussianBlur } from "three/examples/jsm/tsl/display/GaussianBlurNode.js";
import { _adapters } from "chart.js";
import { select, uniform } from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";



export function PP_Xdog() {
    const { scenePass } = useWebGPUPostProcessing();

    const [controls] = useControls(() => ({
        Render: folder({
            PostProcess: folder({
                Xdog: folder({
                    enabled: { value: true },
                    sigma1: { value: .5, min: 0.0, max: 5.0, step: 0.01 },
                    sigma2: { value: .5, min: 0.0, max: 5.0, step: 0.01 },
                    Tres: { value: .1, min: 0.0, max: 2, step: 0.01 },
                    P: { value: 5, min: 0.0, max: 20.0, step: 0.01 },
                    Fi: { value: 5, min: 0.0, max: 5.0, step: 0.01 },
                },
                )
            })
        })
    }));

    const uniforms = useMemo(() => ({
        Tres: uniform(controls.Tres),
        P: uniform(controls.P),
        Fi: uniform(controls.Fi),
    }), []);

    useEffect(() => { uniforms.Tres.value = controls.Tres; }, [controls.Tres]);
    useEffect(() => { uniforms.P.value = controls.P; }, [controls.P]);
    useEffect(() => { uniforms.Fi.value = controls.Fi; }, [controls.Fi]);

    const effect = useCallback((inputNode: THREE.Node) => {
        if (!inputNode || !scenePass || !controls.enabled) return inputNode;

        //const blur1 = gaussianBlur(inputNode, undefined, controls.sigma1);
        const blur1 = inputNode;
        const blur2 = gaussianBlur(blur1, undefined, controls.sigma2);

        const tau = uniforms.P
        const amp = blur1.xyz.length().mul(tau.add(1.0)).sub(blur2.xyz.length().mul(tau));
        const amp2 = select(amp.greaterThan(1.0), 1.0, tanh(uniforms.Fi.degrees().mul(amp.sub(uniforms.Tres))).add(1.0) )

        return amp2.clamp(0.0,1.0).mul(inputNode);
        return inputNode.sub(blur1);
    }, [scenePass, controls.enabled, controls.sigma1,controls.sigma2]);



    PostProcessingEffect(effect);

    return null;
}


export const tanh = Fn(([x]: [THREE.Node]) => {
    const ex = x.exp();
    const emx = x.negate().exp();
    return ex.sub(emx).div(ex.add(emx));
})