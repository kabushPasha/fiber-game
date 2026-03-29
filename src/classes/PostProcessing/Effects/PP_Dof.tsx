import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { float, screenUV, screenSize, texture, uniform, vec2, vec3, getViewPosition, mix } from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";
import { folder, useControls } from "leva";
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber";

export function PP_DoF() {
    const { scenePass } = useWebGPUPostProcessing();

    const { enabled, focusDistance, focusRange, blurStrength, debug } = useControls("Render", {
        PostProcess: folder({
            DoF: folder({
                enabled: false,
                debug: false,
                focusDistance: { value: 5.0, min: -200, max: 200, step: 0.1 },
                focusRange: { value: 2.0, min: 0.1, max: 100, step: 0.1 },
                blurStrength: { value: 2.0, min: 0.1, max: 10, step: 0.1 }
            })
        })
    });

    const uniforms = useMemo(() => ({
        focusDistance: uniform(focusDistance),
        focusRange: uniform(focusRange),
        blurStrength: uniform(blurStrength),
        cam_projMatrixInverse: uniform(new THREE.Matrix4())
    }), []);

    useEffect(() => {
        uniforms.focusDistance.value = focusDistance;
        uniforms.focusRange.value = focusRange;
        uniforms.blurStrength.value = blurStrength;
    }, [focusDistance, focusRange, blurStrength]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !scenePass || !enabled) return inputNode;

        const depthTex = scenePass.getTextureNode("depth");
        const uv = screenUV;
        const pixel = scenePass.getTextureNode("output");

        // Reconstruct view-space Z (optional)
        const viewZ = getViewPosition(uv, texture(depthTex, uv).r, uniforms.cam_projMatrixInverse).z;

        // Compute Circle of Confusion (CoC)
        const coc = ((viewZ.sub(uniforms.focusDistance)).div(uniforms.focusRange)).clamp(-1.0, 1.0).abs();

        // Simple blur: sample neighbors proportional to CoC
        const e = vec2(1.0).div(screenSize.xy);
        const blurRadius = coc.mul(uniforms.blurStrength);

        const blurred = Fn(() => {
            let result = vec3(0).toVar();
            const samples = 3;
            for (let y = -samples; y <= samples; y++) {
                for (let x = -samples; x <= samples; x++) {
                    const offset = uv.add(vec2(x, y).mul(e).mul(blurRadius));
                    result.addAssign(texture(pixel, offset));
                }
            }
            return result.div(float((samples * 2 + 1) ** 2));
        })();

        if (debug) return coc; // visualize CoC
        return mix(pixel, blurred, coc); // mix original + blurred by CoC
    }, [enabled]);

    const {camera} = useThree( );    

    useFrame( () => {
        uniforms.cam_projMatrixInverse.value.fromArray( camera.projectionMatrixInverse.toArray() );        
    }) 

    PostProcessingEffect(effect);
    return null;
}