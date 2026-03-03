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
    texture: THREE.Texture;
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
    hf_size = 200,
    hf_height = 20,
    children,
}: Props) {

    const hf_tex = useLoader(TextureLoader, textureUrl);

    hf_tex.wrapS = THREE.RepeatWrapping;
    hf_tex.wrapT = THREE.RepeatWrapping;
    hf_tex.colorSpace = THREE.NoColorSpace;
    hf_tex.minFilter = THREE.NearestFilter;
    hf_tex.magFilter = THREE.NearestFilter;
    hf_tex.generateMipmaps = false;

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

            const i = Math.floor(u * (width - 1));
            const j = Math.floor(v * (height - 1));

            return heights[j * width + i] * hf_height;
        }

        return {
            heights,
            width,
            height,
            hf_height,
            hf_size,
            texture: hf_tex,
            getHeightAtPos,
        };

    }, [heights, width, height, hf_size, hf_height, hf_tex]);

    return (
        <TerrainContext.Provider value={terrainData}>
            {children}
        </TerrainContext.Provider>
    );
}


function textureToHeightData(    hf_tex: THREE.Texture,): number[] {
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