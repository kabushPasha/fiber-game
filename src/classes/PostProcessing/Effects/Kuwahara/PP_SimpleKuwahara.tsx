
import { useCallback, } from "react";

import * as THREE from "three/webgpu"
import { PostProcessingEffect, useWebGPUPostProcessing } from "../../PostProcessingContext";
import { convertToTexture, float, If, screenUV, texture, textureSize, vec2, vec3 } from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";

//import { useUI } from "../../../components/UIScreenContext";
//import { FloatingPalette } from "../../../components/Palette/FloatingPalette";



export function PP_KuwaharaSimple() {
    const { scenePass } = useWebGPUPostProcessing();



    const effect = useCallback((inputNode: THREE.Node) => {
        if (!inputNode || !scenePass) return inputNode;

        const kuwaharaMulti = Fn(() => {
            let out = inputNode;
            for (let i = 0; i < 10; i++) {
                out = kuwaharaSimple(out);
            }
            return out;
        })

        return kuwaharaMulti();
    }, [scenePass]);

    PostProcessingEffect(effect);

    return null;
}


const kuwaharaSimple = Fn(([input]: [THREE.Node]) => {


    const input_tex = convertToTexture(input);
    const texel = vec2(1.0, 1.0).div(textureSize(input_tex));

    const kernel_size = 3;
    const min_variance = float(9999).toVar()
    const src = texture(input_tex, screenUV)
    const out = src.toVar()

    const dirs = [
        vec2(1, 1),
        vec2(-1, 1),
        vec2(1, -1),
        vec2(1, 1),
    ]

    for (const dir of dirs) {
        const mean = vec3(0.0).toVar();
        const variance = float(0.0).toVar();

        for (let i = 0; i <= kernel_size; i++) {
            for (let j = 0; j <= kernel_size; j++) {
                const val = texture(input_tex, screenUV.add(dir.mul(vec2(i, j)).mul(texel)))
                mean.addAssign(val)
                const deviation = src.sub(val)
                variance.addAssign(deviation.mul(deviation));
            }
        }
        mean.divAssign((kernel_size + 1) * (kernel_size + 1))

        If(variance.length().lessThan(min_variance), () => {
            out.assign(mean);
            min_variance.assign(variance.length());
        })
    }
    return out;
})