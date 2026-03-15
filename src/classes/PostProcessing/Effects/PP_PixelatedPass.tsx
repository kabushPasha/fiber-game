import { useThree } from "@react-three/fiber";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import * as THREE from "three/webgpu";
import { useCallback, useEffect, useMemo } from "react";
import { clamp, getViewPosition, mix, screenSize, screenUV, smoothstep, texture, uniform, vec2, vec3 } from "three/tsl";
import { FogNode } from "../FogPass";
import { folder, useControls } from "leva";
import { useCameraUniforms } from "../cameraUniformsContext";
import { Fn } from "three/src/nodes/TSL.js";




export function PP_PixelHighlights() {
    const { scenePass } = useWebGPUPostProcessing();
    const cameraUniforms = useCameraUniforms();

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

        const centerDepth = texture(depth, screenUV);
        const d8     = texture(depth, screenUV.add(e.mul(vec2(0,1))));
        const d2     = texture(depth, screenUV.add(e.mul(vec2(0,-1))));
        const d4     = texture(depth, screenUV.add(e.mul(vec2(-1,0))));
        const d6     = texture(depth, screenUV.add(e.mul(vec2(1,0))));


        const depthDiff = clamp(d8.sub(centerDepth), 0.0, 1.0)
                .add( clamp(d2 .sub( centerDepth), 0.0, 1.0))
                .add(clamp(d4 .sub( centerDepth), 0.0, 1.0))
                .add(clamp(d6 .sub( centerDepth), 0.0, 1.0));

        const smooth_depthDiff = smoothstep(0.2, 0.3, depthDiff.pow(0.25)); // optional smoothing
        
        //return smooth_depthDiff;
        return mix(inputNode, vec3(0,0,0), smooth_depthDiff.mul(0.5));

        //return texture(depth,screenUV).sub( texture(depth,screenUV.add(d))  );
        //return fog;

    }, [scenePass]); // NOT density



    PostProcessingEffect(effect);

    return null;
}

const getRealDepth = Fn(([depthTex,uvNode,cameraProjectionMatrixInverse]:[any,any,any]) => {
    const depth = texture(depthTex, uvNode).r;
    const viewPos = getViewPosition(uvNode, depth, cameraProjectionMatrixInverse);
    const viewDepth = viewPos.length().min(100);
    return viewDepth;
})



