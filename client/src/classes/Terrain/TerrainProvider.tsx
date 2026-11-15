import { createContext, useContext, useEffect } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { Fn, texture, uniform, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import type { ShaderNodeFn } from "three/src/nodes/TSL.js";
import { useTerrainControlsUI } from "./TerrainControlsLeva";
import { EXRLoader } from "three/examples/jsm/Addons.js";

/**
 * To read EXR it hould have 4 channels, not 1
 * Also percision can be 16bit int
 * 
 * 
 */



/** CONTEXT */
export type TerrainData = {
    heights: number[];
    width: number;
    height: number;
    hf_height: number;
    hf_size: number;
    hf_tex: THREE.Texture;
    hf_nml: THREE.Texture;
    getHeightAtPos: (worldPos: THREE.Vector3) => number;
    tsl_sampleHeight: ShaderNodeFn<[Node]>
    tsl_sampleN: ShaderNodeFn<[Node]>
    tsl_sampleColor: ShaderNodeFn<[Node]>
    tsl_ws2sample: ShaderNodeFn<[Node]>
};

export const TerrainContext = createContext<TerrainData | null>(null);

export function useTerrain() {
    const ctx = useContext(TerrainContext);
    if (!ctx) throw new Error("useTerrain must be used inside TerrainProvider");
    return ctx;
}



/** PROVIDER */
export type TerrainProps = {
    textureUrl: string;
    hf_size?: number;
    hf_height?: number;
    children?: React.ReactNode;
    showUI?: boolean;
    color?: string;
};

export function TerrainProvider(_props: TerrainProps) {

    const { textureUrl, hf_size, hf_height, children, color } = useTerrainControlsUI(_props);

    const uniforms = useMemo(
        () => ({
            color: uniform(vec3(0.3, 0.9, 0.6)),
        }),
        []
    );

    // Update Uniforms
    useEffect(() => {
        const c = new THREE.Color(color);
        uniforms.color.value.set(c.r, c.g, c.b);
    }, [color])


    //const hf_tex = useLoader(TextureLoader, textureUrl);
    const isExr = /\.exr$/i.test(textureUrl.split(/[?#]/)[0]);

    const hf_tex = useLoader(
        isExr ? EXRLoader : TextureLoader,
        textureUrl,
        (loader) => { if (isExr) { (loader as EXRLoader).setDataType(THREE.FloatType); } }
    ) as THREE.Texture;


    hf_tex.wrapS = THREE.RepeatWrapping;
    hf_tex.wrapT = THREE.RepeatWrapping;
    hf_tex.colorSpace = THREE.NoColorSpace;
    //hf_tex.minFilter = THREE.NearestFilter;
    //hf_tex.magFilter = THREE.NearestFilter;
    //hf_tex.generateMipmaps = false;

    const hf_nml = useLoader(TextureLoader, "textures/HFs/height_N.png");
    hf_nml.wrapS = THREE.RepeatWrapping;
    hf_nml.wrapT = THREE.RepeatWrapping;
    hf_nml.colorSpace = THREE.NoColorSpace;

    const image = hf_tex.image as { width: number; height: number; };
    const { width, height } = image;

    const heights = useMemo(() => {
        return textureToHeightData(hf_tex);
    }, [hf_tex]);

    const terrainData = useMemo(() => {

        function getHeightAtPos(worldPos: THREE.Vector3): number {
            const worldX = worldPos.z;
            const worldZ = worldPos.x;

            let u = (worldX / hf_size + 0.5) % 1;
            let v = (worldZ / hf_size + 0.5) % 1;

            if (u < 0) u += 1;
            if (v < 0) v += 1;

            // Convert to continuous pixel space
            const x = u * (width - 1);
            const y = v * (height - 1);

            const x0 = Math.floor(x);
            const x1 = Math.min(x0 + 1, width - 1);
            const y0 = Math.floor(y);
            const y1 = Math.min(y0 + 1, height - 1);

            const tx = x - x0; // fractional part in x
            const ty = y - y0; // fractional part in y

            // Sample 4 neighboring heights
            const h00 = heights[y0 * width + x0];
            const h10 = heights[y0 * width + x1];
            const h01 = heights[y1 * width + x0];
            const h11 = heights[y1 * width + x1];

            // Bilinear interpolation
            const hx0 = THREE.MathUtils.lerp(h00, h10, tx);
            const hx1 = THREE.MathUtils.lerp(h01, h11, tx);
            const h = THREE.MathUtils.lerp(hx0, hx1, ty);

            return h * hf_height;
        }

        const tsl_ws2sample = Fn(([worldPos]: [Node]) => {
            return worldPos.zx.div(hf_size).add(-0.5).mul(vec2(1, -1));
        })

        const tsl_sampleHeight = Fn(([worldPos]: [Node]) => {
            const samplePos = tsl_ws2sample(worldPos);
            const heightSample = texture(hf_tex, samplePos).x.mul(hf_height);
            return heightSample;
        })

        const tsl_sampleN = Fn(([worldPos]: [Node]) => {
            const samplePos = tsl_ws2sample(worldPos);
            const hf_N = texture(hf_nml, samplePos);
            return hf_N;
        })

        // @ts-ignore
        const tsl_sampleColor = Fn(([worldPos]: [Node]) => {
            //const hf_N = texture(hf_nml, samplePos);
            //return hf_N;
            return uniforms.color;
        })


        return {
            heights,
            width,
            height,
            hf_height,
            hf_size,
            hf_tex,
            hf_nml,
            getHeightAtPos,
            tsl_sampleHeight,
            tsl_sampleN,
            tsl_sampleColor,
            tsl_ws2sample
        };

    }, [heights, width, height, hf_size, hf_height, hf_tex]);

    return (
        <TerrainContext.Provider value={terrainData}>
            {children}
        </TerrainContext.Provider>
    );
}




function textureToHeightData(
    hf_tex: THREE.Texture,
    flipY = true
): number[] {

    const img = hf_tex.image as {
        width: number;
        height: number;
        data?: Float32Array | Uint16Array | Uint8Array;
    };

    const { width, height } = img;

    const heights = new Array<number>(width * height);

    let pixels: ArrayLike<number>;
    let channels: number;

    if (img.data) {
        // EXR
        pixels = img.data;
        channels = img.data.length / (width * height);
    } else {
        // PNG
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2D context");

        ctx.drawImage(img as HTMLImageElement, 0, 0);

        pixels = ctx.getImageData(0, 0, width, height).data;
        channels = 4;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            const sourceY = flipY ? height - 1 - y : y;

            const sourceIndex = (sourceY * width + x) * channels;
            const targetIndex = y * width + x;

            heights[targetIndex] = pixels[sourceIndex] /
                (img.data ? 1 : 255);
        }
    }

    return heights;
}