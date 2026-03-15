import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import * as THREE from "three/webgpu";
import { useCallback, } from "react";
import {  float, getViewPosition, mix, screenSize, screenUV, texture, vec2, vec3 } from "three/tsl";
//import { useCameraUniforms } from "../cameraUniformsContext";
import { Fn } from "three/src/nodes/TSL.js";



export function PP_PixelHighlights() {
    const { scenePass } = useWebGPUPostProcessing();

    const effect = useCallback((inputNode: any) => {
        if (!scenePass) return null;

        const depth = scenePass.getTextureNode("depth");
        const e = vec2(1.0).div(screenSize.xy);

        /*
        const centerDepth = getRealDepth(depth, screenUV,cameraUniforms.cameraProjectionMatrixInverse);
        const d8     = getRealDepth(depth, screenUV.add(e.mul(vec2(0,1))),cameraUniforms.cameraProjectionMatrixInverse);
        const d2     = getRealDepth(depth, screenUV.add(e.mul(vec2(0,-1))),cameraUniforms.cameraProjectionMatrixInverse);
        const d4     = getRealDepth(depth, screenUV.add(e.mul(vec2(-1,0))),cameraUniforms.cameraProjectionMatrixInverse);
        const d6     = getRealDepth(depth, screenUV.add(e.mul(vec2(1,0))),cameraUniforms.cameraProjectionMatrixInverse);
        */
        /*
        const centerDepth = texture(depth, screenUV);
        const d8 = texture(depth, screenUV.add(e.mul(vec2(0, 1))));
        const d2 = texture(depth, screenUV.add(e.mul(vec2(0, -1))));
        const d4 = texture(depth, screenUV.add(e.mul(vec2(-1, 0))));
        const d6 = texture(depth, screenUV.add(e.mul(vec2(1, 0))));
        */
        /*
        const depthDiff = clamp(d8.sub(centerDepth), 0.0, 1.0)
            .add(clamp(d2.sub(centerDepth), 0.0, 1.0))
            .add(clamp(d4.sub(centerDepth), 0.0, 1.0))
            .add(clamp(d6.sub(centerDepth), 0.0, 1.0));*/

        //const smooth_depthDiff = smoothstep(0.2, 0.3, depthDiff.pow(0.25)); // optional smoothing   



        //return smooth_depthDiff;
        //return mix(inputNode, vec3(0,0,0), smooth_depthDiff.mul(0.5));

        const lap = laplacian(depth, screenUV, e, 5).step(0.01);
        //return lap;
        return mix(inputNode, vec3(0,0,0), lap.mul(.75))

        //return texture(depth,screenUV).sub( texture(depth,screenUV.add(d))  );
        //return fog;

    }, [scenePass]); // NOT density

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
                const w = float( (x==0 && y==0) ? (size*size-1) : -1  )
                result.addAssign(texture(tex, offset).mul(w));
            }
        }
        return result;
    })();
}