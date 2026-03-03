import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { useLoader, useThree } from "@react-three/fiber";
import { TextureLoader } from "three";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { modelWorldMatrix, positionLocal, uv, vec3, vec4, texture, vec2 } from "three/tsl";


type TerrainProps = {
    hf_size?: number;
    hf_height?: number;
};

export function Terrain({ hf_size = 200, hf_height = 20 }: TerrainProps) {

    const hf_tex = useLoader(TextureLoader, "/textures/HFs/height.png");
    hf_tex.wrapS = THREE.RepeatWrapping;
    hf_tex.wrapT = THREE.RepeatWrapping;
    hf_tex.colorSpace = THREE.NoColorSpace;
    hf_tex.minFilter = THREE.NearestFilter;
    hf_tex.magFilter = THREE.NearestFilter;
    hf_tex.generateMipmaps = false;


    const { width, height } = hf_tex.image as HTMLImageElement;
    const heights = useMemo(() => {
        return textureToHeightData(hf_tex);
    }, [texture]);

    const { scene } = useThree()
    useEffect(() => {
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

        scene.userData.terrain = {
            heights,                  // array of numbers
            width,             // heightfield columns
            height,           // heightfield rows
            hf_height,   // y scale
            hf_size,    // x/z scale
            hf_tex,          // optional texture reference
            getHeightAtPos,
        };
    }, [heights, width, height, hf_height, hf_size, hf_tex]);

    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();
        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1)).div(hf_size).add(-0.5);
        const height = texture(hf_tex, worldPos.zx.mul(vec2(1, -1))).x;
        mat.positionNode = positionLocal.add(vec3(0, 0, height.mul(hf_height)));
        mat.colorNode = height;
        //mat.wireframe = true;
        return mat;
    }, [hf_size, hf_height]);


    return (
        <>
            <RigidBody type="fixed" >
                <HeightfieldCollider
                    args={[
                        height - 1,
                        width - 1,
                        heights,
                        { x: hf_size, y: hf_height, z: hf_size },
                    ]}
                />
            </RigidBody>

            {1 &&
                <mesh rotation-x={-Math.PI / 2} material={material} position={[0, 0, 0]}>
                    <planeGeometry args={[hf_size, hf_size, (width - 1), (height - 1),]} />
                </mesh>
            }
        </>
    );
}

function textureToHeightData(
    hf_tex: THREE.Texture,
): number[] {
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



export function TerrainPlane() {
    const { scene, camera } = useThree();

    const terrain = scene.userData.terrain;


    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();

        //const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1)).div(hf_size).add(-0.5);
        //const height = texture(hf_tex, worldPos.zx.mul(vec2(1, -1))).x;
        //mat.positionNode = positionLocal.add(vec3(0, 0, height.mul(hf_height)));
        //mat.colorNode = height;

        mat.wireframe = true;
        return mat;
    }, []);



    return <group name="TerrainPlane">
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} material={material}>
            <planeGeometry args={[10, 10, 5, 5]} />
        </mesh>
    </group>
}



