import { PostProcessingEffect } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { texture3D, uniform, mix } from "three/tsl";
import { useControls, folder } from "leva";

import { LUTCubeLoader } from "three/addons/loaders/LUTCubeLoader.js";
import { LUT3dlLoader } from "three/addons/loaders/LUT3dlLoader.js";
import { LUTImageLoader } from "three/addons/loaders/LUTImageLoader.js";

export function PP_LUT() {

    const { enabled, intensity, lut } = useControls("Render", {
        PostProcess: folder({
            LUT: folder({
                enabled: true,
                lut: {        
                    value: "Kodak 5218 Kodak 2383 (by Adobe).cube",            
                    options: {
                        // PNG LUTs
                        Neutral: "NeutralLUT.png",
                        Night: "NightLUT.png",

                        // CUBE LUTs
                        Candlelight: "Candlelight.CUBE",
                        NightFromDay: "NightFromDay.CUBE",

                        "Fuji ETERNA 250D → Fuji 3510": "Fuji ETERNA 250D Fuji 3510 (by Adobe).cube",
                        "Fuji F125 → Kodak 2393": "Fuji F125 Kodak 2393 (by Adobe).cube",
                        "Fuji REALA 500D → Kodak 2393": "Fuji REALA 500D Kodak 2393 (by Adobe).cube",

                        "Kodak 5205 → Fuji 3510": "Kodak 5205 Fuji 3510 (by Adobe).cube",
                        "Kodak 5218 → Kodak 2383": "Kodak 5218 Kodak 2383 (by Adobe).cube",
                    }
                },
                intensity: {
                    value: 0.5,
                    min: 0,
                    max: 1,
                    step: 0.01
                }
            })
        })
    });

    const [lutTexture, setLutTexture] = useState<any>(null);

    // uniforms
    const uniforms = useMemo(() => ({
        intensity: uniform(intensity)
    }), []);

    useEffect(() => {
        uniforms.intensity.value = intensity;
    }, [intensity]);

    // 🔥 Load LUT internally
    useEffect(() => {
        let active = true;

        const load = async () => {
            let result: any;

            const lower = lut.toLowerCase();
            if (lower.endsWith(".cube")) {
                result = await new LUTCubeLoader().loadAsync(`luts/${lut}`);
            } else if (lower.endsWith(".3dl")) {
                result = await new LUT3dlLoader().loadAsync(`luts/${lut}`);
            } else {
                result = await new LUTImageLoader().loadAsync(`luts/${lut}`);
            }

            console.log(result);
            if (!active) return;

            // Normalize result
            const texture =
                result.texture3D ||
                result.texture ||   // LUTImageLoader fallback
                result;

            setLutTexture(texture);
        };

        load();

        return () => {
            active = false;
        };
    }, [lut]);

    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !enabled || !lutTexture) return inputNode;

        const color = inputNode.clamp(0, 1);

        const graded = texture3D(lutTexture, color);

        return mix(color, graded, uniforms.intensity);
    }, [enabled, lutTexture]);

    PostProcessingEffect(effect);

    return null;
}