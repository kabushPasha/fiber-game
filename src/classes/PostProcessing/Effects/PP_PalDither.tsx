import { useLoader } from "@react-three/fiber";
import { PostProcessingEffect, useWebGPUPostProcessing } from "../PostProcessingContext";
import { useCallback, useEffect, useMemo, } from "react";
import { TextureLoader } from "three";
import { float, Fn, instancedArray, instanceIndex, int, mix, screenCoordinate, select, uniform, uniformArray, vec2, vec3, vec4 } from "three/tsl";
import { texture } from "three/src/nodes/TSL.js";
import * as THREE from "three/webgpu"
import { folder, useControls } from "leva";
import { useWebGPURenderer } from "../../Terrain/ScatterAPI/Scatter/SatinFlow";
import { toHsv, ToRgb } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides";

type PP_PalDitherProps = {
    palette?: string;
    dither?: number;
    pal_exposure?: number;
};


export function PP_PalDither({
    palette = "atropoeia-1x.png",
    dither = 0.05,
    pal_exposure = -0.75,
}: PP_PalDitherProps) {
    const { scenePass } = useWebGPUPostProcessing();

    const controls = useControls("Render", {
        PostProcess: folder({
            PalDither: folder({
                enabled: true,
                palette: {
                    value: palette,
                    options: {
                        "24 Ghostly Spooky Gold": "24-ghostly-spooky-colors-and-gold-1x.png",
                        "31": "31-1x.png",
                        "Abandoned Blue": "abandoned-blue-1x.png",
                        "Aging": "aging-1x.png",
                        "Apollo": "apollo-1x.png",
                        "Astartes 18": "astartes-18-1x.png",
                        "Atropoeia": "atropoeia-1x.png",
                        "Bestiary": "bestiary-1x.png",
                        "Brazilian Afternoon": "brazilian-afternoon-1x.png",
                        "CC 29": "cc-29-1x.png",
                        "Chee 48": "chee48-1x.png",
                        "Claude Monet 12": "claude-monet-12-1x.png",
                        "Color Miku": "color-miku-1x.png",
                        "Daydreams 24": "daydreams24-1x.png",
                        "Desunc": "desunc-1x.png",
                        "Dojovo": "dojovo-1x.png",
                        "DS 34": "ds-34-1x.png",
                        "Dungeon 20": "dungeon-20-1x.png",
                        "Earthy": "earthy-1x.png",
                        "Eerie Arts": "eerie-arts-1x.png",
                        "Full Circle": "full-circle-1x.png",
                        "Geisha": "geisha-1x.png",
                        "GOG 64": "gog-64-1x.png",
                        "Gray Weather": "gray-weather-1x.png",
                        "Hofner Dawn": "hofner-dawn-1x.png",
                        "If It Ain't Baroque": "if-it-aint-baroque-dont-fix-it-1x.png",
                        "Jehkoba 8": "jehkoba8-1x.png",
                        "Liminal Breeze": "liminal-breeze-1x.png",
                        "Lowlands 15": "lowlands15-1x.png",
                        "Moorland 46": "moorland-46-1x.png",
                        "Mupix 9": "mupix9-1x.png",
                        "Mushroom": "mushroom-1x.png",
                        "Nanner Jam": "nanner-jam-1x.png",
                        "Night of the Lotus": "night-of-the-lotus-1x.png",
                        "Paper Garden": "paper-garden-1x.png",
                        "Pirate Trouser Dusk": "piratetrousle-dusk-1x.png",
                        "Prismatic Reverie": "prismatic-reverie-1x.png",
                        "Rakichrome 58": "rakichrome-58-1x.png",
                        "Resurrect 64": "resurrect-64-1x.png",
                        "RP Varela 36": "rpvarela36-1x.png",
                        "Sara 98A": "sara-98a-1x.png",
                        "Silk Weave": "silk-weave-1x.png",
                        "Skin Job 16": "skin-job-16-1x.png",
                        "SLSO 8": "slso8-1x.png",
                        "Sneaky 12": "sneaky-12-1x.png",
                        "Soul of the Sea": "soul-of-the-sea-1x.png",
                        "Sunlit Days": "sunlit-days-1x.png",
                        "The Fated Eight": "the-fated-eight-1x.png",
                        "The Greatest Bird": "the-greatest-bird-1x.png",
                        "Twilight RGB": "twilight-rgb-1x.png",
                        "Ty Arcanixium 13": "ty-arcanixium-13-1x.png",
                        "Ty Black Souls 16": "ty-black-souls-16-1x.png",
                        "Ty Dementia Girl 16": "ty-dementia-girl-16-1x.png",
                        "Ty Disaster Girl 20": "ty-disaster-girl-20-1x.png",
                        "Ty Forest of Miracles 17": "ty-forest-of-miracles-17-1x.png",
                        "Ty Monster Dungeons 22": "ty-monster-dungeons-22-1x.png",
                        "Ty Sacrilland 28": "ty-sacrilland-28-1x.png",
                        "Ty Taikoncolor 24": "ty-taikoncolor-24-1x.png",
                        "Undernight 20": "undernight-20-1x.png",
                        "Vinik 24": "vinik24-1x.png",
                        "Waldgeist": "waldgeist-1x.png",
                        "Warm Summer": "warm-summer-1x.png",
                        "Witchy": "witchy-1x.png",
                        "Worms Open Warfare 2": "worms-open-warfare-2-1x.png"
                    }
                },

                blend: { value: 0.0, min: 0, max: 1.0, step: 0.01 },
                dither: { value: dither, min: 0.0, max: .1, step: 0.001 },
                pal_exposure: { value: pal_exposure, min: -3.0, max: 3.0, step: 0.25 },
                Preprocess: folder({
                    exposure_pre: { value: 0.0, min: -3.0, max: 3.0, step: 0.1 },
                    saturation: { value: 1.0, min: 0.0, max: 4.0, step: 0.01 },
                    hue_pre: { value: 0.0, min: -1.0, max: 1.0, step: 0.001 },
                })
            })
        })
    });

    const uniforms = useMemo(() => ({
        blend: uniform(controls.blend),
        dither: uniform(controls.dither),
        pal_exposure: uniform(controls.pal_exposure),
    }), []);


    useEffect(() => { uniforms.blend.value = controls.blend; }, [controls.blend]);
    useEffect(() => { uniforms.dither.value = controls.dither; }, [controls.dither]);
    useEffect(() => { uniforms.pal_exposure.value = controls.pal_exposure; }, [controls.pal_exposure]);

    const textureUrl = `textures/palletes/${controls.palette}`;
    const pal_tex = useLoader(TextureLoader, textureUrl);


    const renderer = useWebGPURenderer()

    const pal_RT = useMemo(() => {

        const pal_RT = instancedArray(pal_tex.image.width, 'vec3').setName('pallete_rt');

        const update = Fn(() => {

            const out_cd = vec3(0.0).toVar();
            const i = instanceIndex;
            const u = float(i).add(0.5).div(float(pal_tex.image.width));
            const col = texture(pal_tex, vec2(u, 0.5)).rgb;
            out_cd.assign(col.mul(float(2.0).pow(controls.exposure_pre)));

            // --- Saturation ---
            const gray = out_cd.r.mul(0.299).add(out_cd.g.mul(0.587)).add(out_cd.b.mul(0.114));
            out_cd.assign(mix(vec3(gray), out_cd, controls.saturation));

            // --- Hue shift ---
            const hsv = toHsv(out_cd);
            const shiftedH = hsv.x.add(controls.hue_pre).fract();
            out_cd.assign(ToRgb(vec3(shiftedH, hsv.y, hsv.z)));

            pal_RT.element(i).assign(out_cd);

        })().compute(pal_tex.image.width);

        renderer.computeAsync(update, pal_tex.image.width);

        return pal_RT;
    }, [pal_tex, controls.exposure_pre, controls.hue_pre, controls.saturation]);



    const effect = useCallback((inputNode: any) => {
        if (!inputNode || !scenePass) return inputNode;

        const PALETTE_SIZE = pal_tex.image.width;

        const pixel = screenCoordinate.mod(4.0);

        //const resolution = inputNode.resolution();
        //const pixel = uv.mul(resolution);

        const index = pixel.y.mul(4).add(pixel.x);
        const bayer = bayerMatrix.element(int(index)).div(16.0);

        const getNearestPalColor = Fn(([cd]: [THREE.Node]) => {

            const bestDist = float(9999).toVar();
            const bestColor = vec3(0.0).toVar();

            bestColor.assign(vec3(0.0, 0.0, 0.0));
            bestDist.minAssign(cd.length());

            for (let i = 0; i < PALETTE_SIZE; i++) {
                //const u = float(i + 0.5).div(PALETTE_SIZE);
                //const palColor = texture(pal_tex, vec2(u, 0.5)).rgb;
                const palColor = pal_RT.element(i);

                const dist = cd.distance(palColor);

                bestColor.assign(select(dist.lessThan(bestDist), palColor, bestColor));
                bestDist.minAssign(dist, bestDist);
            }

            return vec4(bestColor, 1.0);
        })

        const exposed_input = inputNode.pow(vec3(float(2.0).pow(uniforms.pal_exposure)));
        const clamped_cd = getNearestPalColor(exposed_input.add(bayer.sub(0.5).mul(uniforms.dither)));
        const exposed_output = clamped_cd.pow(vec3(float(2.0).pow(uniforms.pal_exposure.negate())))

        //const clamped_cd = getNearestPalColor(inputNode.add(bayer.sub(0.5).mul(uniforms.dither)));
        return uniforms.blend.mix(exposed_output, inputNode);

    }, [scenePass, uniforms, pal_RT]);

    PostProcessingEffect(effect);

    return null;
}



const bayerMatrix = uniformArray(
    [
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5
    ],
    'float'
);