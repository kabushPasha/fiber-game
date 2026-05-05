import { useThree } from "@react-three/fiber";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { useCameraUniforms } from "../../cameraUniformsContext";
import { Break, float, Fn, getViewPosition, If, Loop, time, uniform, uv, vec3, vec4 } from "three/tsl";
import { tanh } from "../Kuwahara/PP_XDog";
import { folder, useControls } from "leva";


import * as THREE from "three/webgpu"

/** COOL SHADERS
 * XOR
 * https://www.shadertoy.com/user/Xor/sort=popular&from=0&num=8
 * https://www.xordev.com/arsenal
 * 
 * https://www.shadertoy.com/view/3cKSzc
 * https://www.shadertoy.com/view/3XtGzN
 * https://www.shadertoy.com/view/W3SXRV
 * https://www.shadertoy.com/view/sdSyDW
 * https://www.shadertoy.com/view/wXSXzV
 * https://www.shadertoy.com/view/wfc3z7
 * https://www.shadertoy.com/view/NlGfzz
 * https://www.shadertoy.com/view/33tGzN
 * https://www.shadertoy.com/view/3fKSzc
 * 
 * https://x.com/XorDev/status/1942753949167100407
 * https://x.com/XorDev/status/1956882623000649856
 * https://x.com/XorDev/status/1970235131240817039
 * 
 * 
 * OTHER
 * https://www.shadertoy.com/view/7cBSDR
 */



export function PP_GlowFieldDepth() {
    const { scenePass } = useWebGPUPostProcessing();
    const { camera } = useThree();

    const cam_uniforms = useCameraUniforms()

    const [controls] = useControls(() => ({
        Render: folder({
            PostProcess: folder({
                GlowField: folder({
                    enabled: true,
                    mode: {
                        value: "ground",
                        options: {
                            ground: "ground",
                            phosphor: "phosphor",
                            waveform: "waveform",
                        },
                    },
                    displace: { value: 1.0, min: 0.0, max: 3.0, step: 0.01 },
                    ground: { value: .0, min: -3.0, max: 3.0, step: 0.01 },
                    freq_mul: { value: 1.0, min: .1, max: 2.0, step: 0.01 },
                },
                )
            })
        })
    }));

    const uniforms = useMemo(() => ({
        displace: uniform(controls.displace),
        ground: uniform(controls.ground),
        freq_mul: uniform(controls.freq_mul),
    }), []);

    useEffect(() => { uniforms.displace.value = controls.displace; }, [controls.displace]);
    useEffect(() => { uniforms.ground.value = controls.ground; }, [controls.ground]);
    useEffect(() => { uniforms.freq_mul.value = controls.freq_mul; }, [controls.freq_mul]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !scenePass || !controls.enabled) return inputNode;

        const depth_tex = scenePass.getTextureNode("depth");
        const viewPos = getViewPosition(uv(), depth_tex, cam_uniforms.cameraProjectionMatrixInverse);
        const worldPos = cam_uniforms.cameraWorldMatrix.mul(vec4(viewPos, 1.0)).xyz;

        const ray_origin = cam_uniforms.cameraWorldMatrix.mul(vec4(0, 0, 0, 1.0))
        const depth = worldPos.sub(ray_origin).length()
        const rayDir = worldPos.sub(ray_origin).normalize();

        //return SimpleTracer(depth, rayDir, ray_origin, uniforms.displace);

        switch (controls.mode) {
            case "phosphor":
                return Phosphor(depth, rayDir, ray_origin, uniforms.displace);
            case "waveform":
                return WaveForm(depth, rayDir, ray_origin );


            default: return calc_GlowField(depth, rayDir, ray_origin, uniforms.freq_mul, uniforms.displace, uniforms.ground).add(inputNode);
        }


    }, [scenePass, camera, cam_uniforms, uniforms, controls.enabled, controls.mode]);

    PostProcessingEffect(effect);
    return null;
}


const calc_GlowField = Fn(([depth, rayDir, ray_origin, freq_mul, displace, ground]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {
    const rayDistance = float(0.0).toVar()
    const stepSize = float(0.0).toVar()
    const fragColor = vec3(0.0).toVar()

    Loop(100, ({ }) => {
        If(rayDistance.greaterThan(depth), () => { Break(); })

        const samplePos = rayDistance.mul(rayDir).add(ray_origin)

        // Add Noise
        let frequency = 1.0;
        while (frequency < 9.0) {
            const freq = float(frequency).mul(freq_mul);

            samplePos.addAssign(
                samplePos.yzx.mul(freq)
                    .add(rayDistance.mul(0.2))
                    .sub(time.mul(0.2)).cos().div(freq).mul(displace)
            );

            frequency /= 0.7;
        }


        stepSize.assign(samplePos.y.add(ground.negate()).abs().mul(0.1).add(0.02))
        rayDistance.addAssign(stepSize);

        const glowColor = rayDistance.add(time.mul(1.0)).add(vec4(0, 1, 2, 5)).cos().add(1.1);        
        //const glowColor = vec3(1.0)
        fragColor.addAssign(glowColor.div(stepSize));
    });

    return tanh(fragColor.div(2000)).pow(2.2);
})

const Phosphor = Fn(([depth, rayDir, ray_origin, displace]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {
    const rayDistance = float(0.0).toVar()
    const stepSize = float(0.0).toVar()
    const fragColor = vec3(0.0).toVar()

    Loop(80, ({ }) => {
        // Break if Too Deep
        If(rayDistance.greaterThan(depth), () => { Break(); })
        // Sample Pos
        const samplePos = rayDistance.mul(rayDir).add(ray_origin)

        // Dynamic Rotation Axis
        const rotationAxis = vec3(1.0, 2.0, 0.0).add(time).sub(stepSize.mul(8.0)).cos().normalize();
        // Rotate sample position
        const rotatedPos = rotationAxis.mul(rotationAxis.dot(samplePos)).sub(rotationAxis.cross(samplePos));
        //const rotatedPos = samplePos;

        // Turbulence / displacement
        const displacedPos = rotatedPos.toVar();
        for (let i = 1; i < 9; i++) {
            const frequency = float(i);
            displacedPos.addAssign(
                displacedPos.mul(frequency).add(time).sin().yzx.div(frequency).mul(displace)
            )
        }
        // Field value (like signed distance influence)
        const fieldValue = displacedPos.y;

        // Step size (distance estimation)
        stepSize.assign(
            samplePos.length().sub(3.0).abs().mul(0.1)
                .add(fieldValue.abs().mul(0.04))
        )

        //stepSize.assign( displacedPos.length().sub(3.0).abs().mul(0.05).add(0.01)  )
        //stepSize.assign(samplePos.y.add(0.1).abs().mul(0.1).add(0.02).add(fieldValue.abs().mul(0.04)))
        //stepSize.assign(fieldValue.abs().mul(0.04)            .add(samplePos.y.abs().mul(0.01))        )

        rayDistance.addAssign(stepSize);

        // Glow color accumulation
        const glowColor = fieldValue.add(vec4(0.0, 1.0, 2.0, 0.0)).cos().add(1.0)
        //const glowColor = vec3(1.0)
        fragColor.addAssign(glowColor.div(stepSize).mul(rayDistance))

    });

    return tanh(fragColor.div(30000)).pow(2.2);
})


const WaveForm = Fn(([depth, rayDir, ray_origin]: [THREE.Node, THREE.Node, THREE.Node]) => {
    const rayDistance = float(0.0).toVar()
    const fragColor = vec3(0.0).toVar()

    Loop(90, ({ }) => {
        // Break if Too Deep
        If(rayDistance.greaterThan(depth), () => { Break(); })
        // Sample Pos
        const samplePos = rayDistance.mul(rayDir).add(ray_origin)

        // Compute reflection factor (used for mirroring)
        const reflectionFactor = samplePos.y.negate().max(0);

        // Mirror geometry across plane
        samplePos.addAssign(vec3(0, reflectionFactor.mul(2), 0))

        // Apply sine wave deformation
        const waveScale = float(1.0).toVar();
        for (let i = 0; i < 5; i++) // equivalent to d doubling until ~30
        {
            samplePos.addAssign(vec3(0,
                samplePos.mul(waveScale).add(
                    time.mul(2.0).mul(waveScale.cos())
                ).add(rayDistance).cos().x.div(waveScale)
                , 0))
            waveScale.mulAssign(2.0);
        }

        // Compute distance field
        const verticalDistance = samplePos.y.sub(1).abs();

        // Depth-based term
        const depthTerm = samplePos.z.add(3.0);

        // Combine distances (same logic as original, just expanded)
        const stepSize =
            reflectionFactor.mul(0.1).add(
                verticalDistance.div(
                    reflectionFactor.mul(2.0).add(1.0).add(reflectionFactor.mul(reflectionFactor))
                )
            ).add(depthTerm.max(depthTerm.mul(-0.1))).div(8.0);

        // Advance ray
        rayDistance.addAssign(stepSize);

        // Glow color accumulation
        const glowColor = rayDistance.mul(0.5).add(time).add(vec4(0, 2, 4, 3)).cos().add(1.3)
        //const glowColor = vec3(1.0)
        fragColor.addAssign(glowColor.div(stepSize.mul(rayDistance)))

    });

    return tanh(fragColor.div(900)).pow(2.2);
})







//@ts-ignore
export const SimpleTracer = Fn(([depth, rayDir, ray_origin, displace]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {
    const rayDistance = float(0.0).toVar()
    const stepSize = float(0.0).toVar()
    const fragColor = vec3(0.0).toVar()

    Loop(80, ({ }) => {
        // Break if Too Deep
        If(rayDistance.greaterThan(depth), () => { Break(); })
        // Initial Sample Pos
        const samplePos = rayDistance.mul(rayDir).add(ray_origin)


        // Basically we need and SDF and we use its distance from surface as step size 
        // lhe less the distance the brighter the colour we add to the buffer

        // Global Parms
        //const sharpness = 0.1;
        // Sphere Distance
        const radius = 3.0;
        stepSize.assign(samplePos.length().sub(radius).abs().mul(0.1).add(0.01))

        // Plane Distance
        //const height = -3.0;
        //stepSize.assign(samplePos.y.sub(height).abs().mul(0.1).add(0.01))


        rayDistance.addAssign(stepSize);
        // Glow color accumulation
        //const glowColor = rayDistance.add(vec4(0.0, 1.0, 2.0, 0.0)).cos().add(1.0)
        const glowColor = vec3(1.0)
        fragColor.addAssign(glowColor.div(stepSize).mul(rayDistance))

    });

    return tanh(fragColor.div(30000)).pow(2.2);
})

