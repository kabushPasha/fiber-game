import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import * as THREE from "three/webgpu";
import { useCallback, useEffect, useMemo, } from "react";
import { float, getViewPosition, mix, screenSize, screenUV, texture, uniform, vec2, vec3 } from "three/tsl";
//import { useCameraUniforms } from "../cameraUniformsContext";
import { Fn } from "three/src/nodes/TSL.js";
import { folder, useControls } from "leva";



export function PP_PixelHighlights() {
    const { scenePass } = useWebGPUPostProcessing();

    const { enabled, kernelSize, threshold, strength,debug } = useControls("Render", {
        PostProcess: folder({
            PixelEdges: folder({
                enabled: false,
                debug: false,
                kernelSize: {
                    value: 2,
                    min: 1,
                    max: 5,
                    step: 1
                },
                threshold: {
                    value: 1,
                    min: 0,
                    max: 2,
                    step: 0.001
                },
                strength: {
                    value: 0.2,
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            })
        })
    },{collapsed : true}
    );

    const uniforms = useMemo(() => ({
        threshold: uniform(threshold),
        strength: uniform(strength),
    }), []);

    useEffect(() => {
        uniforms.threshold.value = threshold;
        uniforms.strength.value = strength;
    }, [kernelSize, threshold, strength]);


    // PP Pass ---------------
    const effect = useCallback((inputNode: any) => {
        if (!scenePass) return null;
        if (!enabled) return inputNode;

        const depth = scenePass.getTextureNode("normal");
        const e = vec2(1.0).div(screenSize.xy);

        const lap = laplacian(
            depth,
            screenUV,
            e,
            kernelSize * 2 + 1
        ).step(uniforms.threshold).length().abs();

        if(debug) return lap;
        return mix(
            inputNode,
            vec3(0, 0, 0),
            lap.mul(uniforms.strength)
        );
    }, [scenePass, enabled, kernelSize,debug]);


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
