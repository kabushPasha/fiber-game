import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { float, screenSize, screenUV, texture, uniform, vec2, vec3 } from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";
import { folder, useControls } from "leva";


type PPSharpenProps = {
    enabled?: boolean;
    strength?: number;
    kernelSize?: number;
    debug?: boolean;
};

export function PP_Sharpen({
    enabled = true,
    strength = 0.02,
    kernelSize = 2,
    debug = false
}: PPSharpenProps) {
    const { scenePass } = useWebGPUPostProcessing();

    const [controls, set] = useControls(() => ({
        "Render": folder({
            PostProcess: folder({
                Sharpen: folder({
                    enabled: { value: enabled },
                    debug: { value: debug },
                    kernelSize: {
                        value: kernelSize,
                        min: 1,
                        max: 3,
                        step: 1
                    },
                    strength: {
                        value: strength,
                        min: 0,
                        max: 0.5,
                        step: 0.01
                    }
                })
            })
        })
    }));

    useEffect(() => {
        set({ enabled, strength, kernelSize, debug, });
    }, [enabled, strength, kernelSize, debug, set]);

    const uniforms = useMemo(() => ({
        strength: uniform(controls.strength),
    }), []);

    useEffect(() => {
        uniforms.strength.value = controls.strength;
    }, [controls.strength]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !controls.enabled || !scenePass) return inputNode;

        const e = vec2(1.0).div(screenSize.xy);

        // High-pass / Laplacian kernel
        const tex = scenePass.getTextureNode("output");
        const sharpen = laplacian(tex, screenUV, e, controls.kernelSize * 2 + 1);

        if (controls.debug) return sharpen;

        // Mix sharpened edges with original color
        return inputNode.add(sharpen.mul(uniforms.strength));
    }, [scenePass, controls.enabled, controls.kernelSize, controls.debug]);

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