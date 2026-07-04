import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import * as THREE from "three/webgpu";
import { useCallback, useEffect, useMemo, } from "react";
import { float, getViewPosition, mix, screenSize, screenUV, texture, uniform, vec2, vec3 } from "three/tsl";
//import { useCameraUniforms } from "../cameraUniformsContext";
import { Fn } from "three/src/nodes/TSL.js";
import { folder, useControls } from "leva";

type PP_PixelHighlightsProps = {
    enabled?: boolean;
    kernelSize?: number;
    threshold?: number;
    strength?: number;
};


export function PP_PixelHighlights(
    {
        enabled = true,
        kernelSize = 2,
        threshold = 1.0,
        strength = 0.2,
    }: PP_PixelHighlightsProps
) {
    const { scenePass } = useWebGPUPostProcessing();

    const [controls, set, _] = useControls(() => ({
        Render: folder({
            PostProcess: folder({
                PixelEdges: folder({
                    enabled: enabled,
                    debug: false,
                    kernelSize: {
                        value: kernelSize,
                        min: 1,
                        max: 5,
                        step: 1
                    },
                    threshold: {
                        value: threshold,
                        min: 0,
                        max: 2,
                        step: 0.001
                    },
                    strength: {
                        value: strength,
                        min: 0,
                        max: 1,
                        step: 0.01
                    }
                })
            })
        })
    })
    );

    useEffect(() => {
        set({ kernelSize, threshold, strength });
    }, [kernelSize, threshold, strength, set]);

    const uniforms = useMemo(() => ({
        threshold: uniform(controls.threshold),
        strength: uniform(controls.strength),
    }), []);

    useEffect(() => {
        uniforms.threshold.value = controls.threshold;
        uniforms.strength.value = controls.strength;
    }, [controls.kernelSize, controls.threshold, controls.strength]);


    // PP Pass ---------------
    const effect = useCallback((inputNode: any) => {
        if (!scenePass) return null;
        if (!controls.enabled) return inputNode;

        const depth = scenePass.getTextureNode("normal");
        const e = vec2(1.0).div(screenSize.xy);

        const lap = laplacian(
            depth,
            screenUV,
            e,
            controls.kernelSize * 2 + 1
        ).step(uniforms.threshold).length().abs();


        if (controls.debug) return lap;
        return mix(
            inputNode,
            vec3(0, 0, 0),
            lap.abs().mul(uniforms.strength)
        );
    }, [scenePass, controls.enabled, controls.kernelSize, controls.debug]);


    PostProcessingEffect(effect);
    return null;
}

export const getRealDepth = Fn(([depthTex, uvNode, cameraProjectionMatrixInverse]: [any, any, any]) => {
    const depth = texture(depthTex, uvNode).r;
    const viewPos = getViewPosition(uvNode, depth, cameraProjectionMatrixInverse);
    const viewDepth = viewPos.length().min(100);
    return viewDepth;
})


export function convolution(tex: THREE.TextureNode, uv: THREE.Node, d: THREE.Node, kernel: number[], size: number) {
    const half = Math.floor(size / 2);
    return Fn(() => {

        const result = vec3(0).toVar();

        let i = 0;

        for (let y = -half; y <= half; y++) {
            for (let x = -half; x <= half; x++) {

                const offset = uv.add(d.mul(vec2(x, y)));
                const w = float(kernel[i++]);

                result.addAssign(texture(tex, offset).mul(w));
            }
        }
        return result;
    })();
}

function laplacian(tex: THREE.TextureNode, uv: THREE.Node, d: THREE.Node, size: number) {
    const half = Math.floor(size / 2);
    return Fn(() => {
        const result = vec3(0).toVar();

        for (let y = -half; y <= half; y++) {
            for (let x = -half; x <= half; x++) {
                const offset = uv.add(d.mul(vec2(x, y)));
                const w = float((x == 0 && y == 0) ? (size * size - 1) : -1)
                result.addAssign(texture(tex, offset).mul(w));
            }
        }
        return result;
    })();
}
