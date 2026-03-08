import { createContext, useContext } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";

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
};

export const TerrainContext = createContext<TerrainData | null>(null);

export function useTerrain() {
    const ctx = useContext(TerrainContext);
    if (!ctx) throw new Error("useTerrain must be used inside TerrainProvider");
    return ctx;
}

/** PROVIDER */
type Props = {
    textureUrl: string;
    hf_size?: number;
    hf_height?: number;
    children: React.ReactNode;
};

export function TerrainProvider({
    textureUrl,
    hf_size = 512,
    hf_height = 25,
    children,
}: Props) {

    const hf_tex = useLoader(TextureLoader, textureUrl);
    hf_tex.wrapS = THREE.RepeatWrapping;
    hf_tex.wrapT = THREE.RepeatWrapping;
    hf_tex.colorSpace = THREE.NoColorSpace;
    hf_tex.minFilter = THREE.NearestFilter;
    hf_tex.magFilter = THREE.NearestFilter;
    hf_tex.generateMipmaps = false;

    const hf_nml = useLoader(TextureLoader, "textures/HFs/height_N.png");
    hf_nml.wrapS = THREE.RepeatWrapping;
    hf_nml.wrapT = THREE.RepeatWrapping;
    hf_nml.colorSpace = THREE.NoColorSpace;

    const { width, height } = hf_tex.image as HTMLImageElement;

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

        return {
            heights,
            width,
            height,
            hf_height,
            hf_size,
            hf_tex,
            hf_nml,
            getHeightAtPos,
        };

    }, [heights, width, height, hf_size, hf_height, hf_tex]);

    return (
        <TerrainContext.Provider value={terrainData}>
            {children}
        </TerrainContext.Provider>
    );
}


function textureToHeightData(hf_tex: THREE.Texture,): number[] {
    const img = hf_tex.image as HTMLImageElement;
    const { width, height } = img;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");


    ctx.drawImage(img, 0, 0, width, height);

    const pixels = ctx.getImageData(0, 0, width, height).data;
    const heights: number[] = new Array(width * height);

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const i = row * width + col;
            const stride = i * 4;
            const r = pixels[stride];
            heights[i] = (r / 255);
        }
    }
    return heights;
}