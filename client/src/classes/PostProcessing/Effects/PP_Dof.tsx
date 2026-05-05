import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { clamp, convertToTexture, dot, float, Fn, length, mix, screenUV, sin, smoothstep, time, uniform, uv, vec2, vec3 } from "three/tsl";
import { folder, useControls } from "leva";
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber";
import { dof } from "three/examples/jsm/tsl/display/DepthOfFieldNode.js";

export function PP_DoF() {
    const { scenePass } = useWebGPUPostProcessing();

    const { enabled, focusDistance, focusRange, blurStrength } = useControls("Render", {
        PostProcess: folder({
            DoF: folder({
                enabled: true,
                debug: false,
                focusDistance: { value: 20.0, min: 0, max: 200, step: 0.1 },
                focusRange: { value: 40.0, min: 0.1, max: 100, step: 0.1 },
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

        const depth = scenePass.getViewZNode();
        const dofPass = dof(inputNode, depth, uniforms.focusDistance, uniforms.focusRange, uniforms.blurStrength);
        return dofPass;

    }, [enabled, scenePass]);

    const { camera } = useThree();

    useFrame(() => {
        uniforms.cam_projMatrixInverse.value.fromArray(camera.projectionMatrixInverse.toArray());
    })

    PostProcessingEffect(effect);
    return null;
}

export function PP_Vignette() {
    const { scenePass } = useWebGPUPostProcessing();

    const { enabled, intensity, smoothness } = useControls("Render", {
        PostProcess: folder({
            Vignette: folder({
                enabled: true,
                intensity: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
                smoothness: { value: 0.65, min: 0.0, max: 1.0, step: 0.01 }
            })
        })
    });

    const uniforms = useMemo(() => ({
        intensity: uniform(float(intensity)),
        smoothness: uniform(float(smoothness))
    }), []);

    useEffect(() => {
        uniforms.intensity.value = intensity;
        uniforms.smoothness.value = smoothness;
    }, [intensity, smoothness]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !scenePass || !enabled) return inputNode;

        const vignettePass = vignette(
            inputNode,
            uniforms.intensity,
            uniforms.smoothness,
            uv()
        );

        return vignettePass;
    }, [enabled, scenePass]);

    PostProcessingEffect(effect);
    return null;
}



export function PP_Scanline() {
    const { scenePass } = useWebGPUPostProcessing();

    const {
        enabled,
        intensity,
        count,
        speed,
        bleedAmount,
        doBleed,
        doBarrel,
        curvature
    } = useControls("Render", {
        PostProcess: folder({
            Scanlines: folder({
                enabled: true,

                intensity: { value: 0.05, min: 0.0, max: 1.0, step: 0.01 },
                count: { value: 512, min: 10, max: 1000, step: 1 },
                speed: { value: 0.0, min: 0.0, max: 5.0, step: 0.01 },

                bleedAmount: { value: 0.1, min: 0.0, max: 1, step: 0.01 },
                doBleed: true,

                doBarrel: false,
                curvature: { value: 0.1, min: 0.0, max: 0.2, step: 0.01 }
            })
        })
    });

    const uniforms = useMemo(() => ({
        intensity: uniform(float(intensity)),
        count: uniform(float(count)),
        speed: uniform(float(speed)),
        bleedAmount: uniform(float(bleedAmount)),
        curvature: uniform(float(curvature))
    }), []);

    useEffect(() => {
        uniforms.intensity.value = intensity;
        uniforms.count.value = count;
        uniforms.speed.value = speed;
        uniforms.bleedAmount.value = bleedAmount * 0.01;
        uniforms.curvature.value = curvature;
    }, [intensity, count, speed, bleedAmount, curvature]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !scenePass || !enabled) return inputNode;

        let original = inputNode;

        if (doBarrel) {
            const inputTexture = convertToTexture(inputNode);
            original = inputTexture.sample(barrelUV(uniforms.curvature, uv())).rgb;
        }


        // 2. scanlines
        let result = scanlines(
            original,
            uniforms.intensity,
            uniforms.count,
            uniforms.speed,
            uv()
        );

        // 3. optional color bleeding
        if (doBleed) {
            result = colorBleeding(
                result,
                uniforms.bleedAmount
            );
        }

        return result;

    }, [enabled, scenePass, doBleed, doBarrel]);

    PostProcessingEffect(effect);
    return null;
}













/**
 * Returns a radial gradient from center (white) to edges (black).
 * Useful for masking effects based on distance from center.
 *
 * @tsl
 * @function
 * @param {Node<float>} [scale=1.0] - Controls the size of the gradient (0 = all black, 1 = full circle).
 * @param {Node<float>} [softness=0.5] - Controls the edge softness (0 = hard edge, 1 = soft gradient).
 * @param {Node<vec2>} [coord=uv()] - The input UV coordinates.
 * @return {Node<float>} 1.0 at center, 0.0 at edges.
 */
export const circle = Fn(([scale = float(1.0), softness = float(0.5), coord = uv()]: [THREE.Node, THREE.Node, THREE.Node]) => {

    // Center UV coordinates (-0.5 to 0.5)
    const centered = coord.sub(0.5);

    // Calculate distance from center (0 at center, ~0.707 at corners)
    const dist = length(centered).mul(2.0);

    // Calculate inner and outer edges based on scale and softness
    const outer = scale;
    const inner = scale.sub(softness.mul(scale));

    // Smoothstep for soft/hard transition
    return smoothstep(outer, inner, dist);

});



/**
 * Applies vignette effect to darken the edges of the screen.
 *
 * @tsl
 * @function
 * @param {Node<vec3>} color - The input color.
 * @param {Node<float>} [intensity=0.4] - The intensity of the vignette (0-1).
 * @param {Node<float>} [smoothness=0.5] - The smoothness of the vignette falloff.
 * @param {Node<vec2>} [coord=uv()] - The UV coordinates to use for vignette calculation.
 * @return {Node<vec3>} The color with vignette applied.
 */
export const vignette = Fn(([color, intensity = float(0.4), smoothness = float(0.5), coord = uv()]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {

    // Use circle for radial gradient (1.42 ≈ √2 covers full diagonal)
    const mask = circle(float(1.42), smoothness, coord);

    // Apply vignette: center = 1, edges = (1 - intensity)
    const vignetteAmount = mix(float(1.0).sub(intensity), float(1.0), mask);

    return color.mul(vignetteAmount);

});


/**
 * Applies scanline effect to simulate CRT monitor horizontal lines with animation.
 *
 * @tsl
 * @function
 * @param {Node<vec3>} color - The input color.
 * @param {Node<float>} [intensity=0.3] - The intensity of the scanlines (0-1).
 * @param {Node<float>} [count=240] - The number of scanlines (typically matches vertical resolution).
 * @param {Node<float>} [speed=0.0] - The scroll speed of scanlines (0 = static, 1 = normal CRT roll).
 * @param {Node<vec2>} [coord=uv()] - The UV coordinates to use for scanlines.
 * @return {Node<vec3>} The color with scanlines applied.
 */
export const scanlines = Fn(([color, intensity = float(0.3), count = float(240.0), speed = float(0.0), coord = uv()]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {

    // Animate scanlines scrolling down (like CRT vertical sync roll)
    const animatedY = coord.y.sub(time.mul(speed));

    // Create scanline pattern
    const scanline = sin(animatedY.mul(count));
    const scanlineIntensity = scanline.mul(0.5).add(0.5).mul(intensity);

    // Darken alternate lines
    return color.mul(float(1.0).sub(scanlineIntensity));

});




/**
 * Applies color bleeding effect to simulate horizontal color smearing.
 * Simulates the analog signal bleeding in CRT displays where colors
 * "leak" into adjacent pixels horizontally.
 *
 * @tsl
 * @function
 * @param {Node} color - The input texture node.
 * @param {Node<float>} [amount=0.002] - The amount of color bleeding (0-0.01).
 * @return {Node<vec3>} The color with bleeding effect applied.
 */
export const colorBleeding = Fn(([color, amount = float(0.002)]: [THREE.Node, THREE.Node]) => {

    const inputTexture = convertToTexture(color);

    // Get the original color
    const original = inputTexture.sample(screenUV).rgb;

    // Sample colors from the left (simulating signal trailing)
    const left1 = inputTexture.sample(screenUV.sub(vec2(amount, 0.0))).rgb;
    const left2 = inputTexture.sample(screenUV.sub(vec2(amount.mul(2.0), 0.0))).rgb;
    const left3 = inputTexture.sample(screenUV.sub(vec2(amount.mul(3.0), 0.0))).rgb;

    // Red bleeds more (travels further in analog signal)
    const bleedR = original.r
        .add(left1.r.mul(0.4))
        .add(left2.r.mul(0.2))
        .add(left3.r.mul(0.1));

    // Green bleeds medium
    const bleedG = original.g
        .add(left1.g.mul(0.25))
        .add(left2.g.mul(0.1));

    // Blue bleeds least
    const bleedB = original.b
        .add(left1.b.mul(0.15));

    // Normalize and clamp
    const r = clamp(bleedR.div(1.7), 0.0, 1.0);
    const g = clamp(bleedG.div(1.35), 0.0, 1.0);
    const b = clamp(bleedB.div(1.15), 0.0, 1.0);

    return vec3(r, g, b);

});



/**
 * Creates barrel-distorted UV coordinates.
 * The center of the screen appears to bulge outward (convex distortion).
 *
 * @tsl
 * @function
 * @param {Node<float>} [curvature=0.1] - The amount of curvature (0 = flat, 0.5 = very curved).
 * @param {Node<vec2>} [coord=uv()] - The input UV coordinates.
 * @return {Node<vec2>} The distorted UV coordinates.
 */
export const barrelUV = Fn(([curvature = float(0.1), coord = uv()]: [THREE.Node, THREE.Node]) => {

    // Center UV coordinates (-1 to 1)
    const centered = coord.sub(0.5).mul(2.0);

    // Calculate squared distance from center
    const r2 = dot(centered, centered);

    // Barrel distortion: push center outward (bulge effect)
    const distortion = float(1.0).sub(r2.mul(curvature));

    // Calculate scale to compensate for edge expansion
    // At corners r² = 2, so we scale by the inverse of corner distortion
    const cornerDistortion = float(1.0).sub(curvature.mul(2.0));

    // Apply distortion and compensate scale to keep edges aligned
    const distorted = centered.div(distortion).mul(cornerDistortion).mul(0.5).add(0.5);

    return distorted;

});