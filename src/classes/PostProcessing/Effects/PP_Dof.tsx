import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { uniform } from "three/tsl";
import { folder, useControls } from "leva";
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber";
import { dof } from "three/examples/jsm/tsl/display/DepthOfFieldNode.js";

export function PP_DoF() {
    const { scenePass } = useWebGPUPostProcessing();

    const { enabled, focusDistance, focusRange, blurStrength } = useControls("Render", {
        PostProcess: folder({
            DoF: folder({
                enabled: false,
                debug: false,
                focusDistance: { value: 10.0, min: 0, max: 200, step: 0.1 },
                focusRange: { value: 20.0, min: 0.1, max: 100, step: 0.1 },
                blurStrength: { value: 1.0, min: 0.0, max: 10, step: 0.01 }
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

        const depth =  scenePass.getViewZNode();
        const dofPass = dof( inputNode, depth, uniforms.focusDistance, uniforms.focusRange,uniforms.blurStrength );
        return dofPass;

    }, [enabled]);

    const {camera} = useThree( );    

    useFrame( () => {
        uniforms.cam_projMatrixInverse.value.fromArray( camera.projectionMatrixInverse.toArray() );        
    }) 

    PostProcessingEffect(effect);
    return null;
}