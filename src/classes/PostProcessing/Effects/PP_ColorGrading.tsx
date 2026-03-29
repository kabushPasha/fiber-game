import { PostProcessingEffect } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo } from "react";
import { float, mix, uniform, vec3,  pow,  fract, add, sub } from "three/tsl";
import { useControls, folder } from "leva";
import { toHsv, ToRgb } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";


export function PP_ColorGrading() {

    // ------------------ Controls ------------------
    const { enabled, exposure, saturation, hue, temperature, tint } = useControls("Render", {
        PostProcess: folder({
            ColorGrading: folder({
                enabled: false,
                exposure: { value: 0, min: -2, max: 2, step: 0.01 },
                saturation: { value: 1, min: 0, max: 2, step: 0.01 },
                hue: { value: 0, min: -1, max: 1, step: 0.001 },
                temperature: { value: 0, min: -1, max: 1, step: 0.01 },
                tint: { value: 0, min: -1, max: 1, step: 0.01 }
            })
        })
    });

    const uniforms = useMemo(() => ({
        exposure: uniform(exposure),
        saturation: uniform(saturation),
        hue: uniform(hue),
        temperature: uniform(temperature),
        tint: uniform(tint)
    }), []);

    useEffect(() => {
        uniforms.exposure.value = exposure;
        uniforms.saturation.value = saturation;
        uniforms.hue.value = hue;
        uniforms.temperature.value = temperature;
        uniforms.tint.value = tint;
    }, [exposure, saturation, hue, temperature, tint]);

    // ------------------ Effect ------------------
    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !enabled) return inputNode;

        let color = inputNode.clamp(0, 1);

        // --- Exposure ---
        color = pow(color, vec3(float(2.0).pow(sub(float(0.0), uniforms.exposure))));

        // --- White balance / Temperature & Tint ---
        // Simple approximation using RGB multipliers
        const temp = uniforms.temperature;
        const tnt = uniforms.tint;
        const wb = vec3(
            add(float(1.0), sub(temp, tnt)),  // R = 1 + temp - tint
            float(1.0),                        // G = 1
            add(float(1.0), sub(tnt, temp))   // B = 1 + tint - temp
        );
        color = color.mul(wb);

        // --- Saturation ---
        const gray = color.r.mul(0.299).add(color.g.mul(0.587)).add(color.b.mul(0.114));
        color = mix(vec3(gray), color, uniforms.saturation);

        // --- Hue shift ---
        const hsv = toHsv(color);
        const shiftedH = fract(hsv.x.add(uniforms.hue));
        const finalColor = ToRgb(vec3(shiftedH, hsv.y, hsv.z));

        return finalColor.clamp(0, 1);

    }, [enabled]);

    PostProcessingEffect(effect);

    return null;
}