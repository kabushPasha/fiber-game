import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { float, screenSize, screenUV, texture, uniform, vec2, vec3 } from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";
import { folder, useControls } from "leva";

export function PP_Sharpen() {
    const { scenePass } = useWebGPUPostProcessing();

    const { enabled, strength, kernelSize, debug } = useControls("Render", {
        PostProcess: folder({
            Sharpen: folder({
                enabled: false,
                debug: false,
                kernelSize: { value: 2, min: 1, max: 3, step: 1 },
                strength: { value: 0.02, min: 0, max: 0.5, step: 0.01 }
            })
        })
    });

    const uniforms = useMemo(() => ({
        strength: uniform(strength),
    }), []);

    useEffect(() => {
        uniforms.strength.value = strength;
    }, [strength]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !enabled || !scenePass) return inputNode;

        const e = vec2(1.0).div(screenSize.xy);

        // High-pass / Laplacian kernel
        const tex = scenePass.getTextureNode("output");
        const sharpen = laplacian(tex, screenUV, e, kernelSize * 2 + 1);

        if (debug) return sharpen;

        // Mix sharpened edges with original color
        return inputNode.add(sharpen.mul(uniforms.strength));
    }, [scenePass,enabled, kernelSize, debug]);

    PostProcessingEffect(effect);

    return null;
}

// Laplacian helper (same as your PP_PixelHighlights)
function laplacian(tex: any, uv: any, d: any, size: number) {
    const half = Math.floor(size / 2);
    return Fn(() => {
        const result = vec3(0).toVar();

        for (let y = -half; y <= half; y++) {
            for (let x = -half; x <= half; x++) {
                const offset = uv.add(d.mul(vec2(x, y)));
                const w = float((x === 0 && y === 0) ? (size * size - 1) : -1);
                result.addAssign(texture(tex, offset).mul(w));
            }
        }
        return result;
    })();
}