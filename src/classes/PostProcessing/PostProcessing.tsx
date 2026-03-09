import * as THREE from "three/webgpu"
import {
    pass,
    mrt,
    output,
    transformedNormalView,
    metalness,
    blendColor,
    depth,
    emissive,
} from "three/tsl";
import { useThree, useFrame } from "@react-three/fiber"
import { useEffect, useRef } from "react"

export function WebGPUPostProcessing() {
    const { gl: renderer, scene, camera } = useThree()
    const postProcessingRef = useRef<any>(null)

    useEffect(() => {
        if (!renderer || !scene || !camera) return;

        // Create post-processing setup with specific filters
        const scenePass = pass(scene, camera, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });

        // Setup Multiple Render Targets (MRT)
        scenePass.setMRT(
            mrt({
                output: output,
                normal: transformedNormalView,
                metalness: metalness,
                emissive: emissive,
            })
        );

        // Get texture nodes
        const scenePassColor = scenePass.getTextureNode("output");
        const scenePassNormal = scenePass.getTextureNode("normal");
        const scenePassDepth = scenePass.getTextureNode("depth");
        const scenePassMetalness = scenePass.getTextureNode("metalness");
        const scenePassEmissive = scenePass.getTextureNode("emissive");


        // Passes


        // Setup post-processing
        //@ts-ignore
        const postProcessing = new THREE.PostProcessing(renderer);
        postProcessing.outputNode = scenePassColor;
        postProcessingRef.current = postProcessing;

        return () => {
            postProcessingRef.current = null;
        };

    }, [renderer, scene, camera])

    useFrame(({ gl }) => {
        if (postProcessingRef.current) {
            gl.clear();
            postProcessingRef.current.render()
        }
    }, 1)

    return null
}