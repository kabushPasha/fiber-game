import { useEffect, useMemo } from "react";
import { usePlayer } from "../../../Player/PlayerContext";
import { useTerrain } from "../../TerrainProvider";
import { GLTFGeometry, GridScatter, InstancedMeshSimple, remapFromMin, SnapToTerrainHeightCPU, TransformsBufferProvider, useGrid, useTransformsBuffer, WrapAroundPlayerGPU } from "./TransformsProvides";
import { instanceIndex, normalLocal, positionLocal, transformNormalToView, vec4, length, screenUV, rand, step, texture, uv, vertexColor, uniform, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";
import { useLoader } from "@react-three/fiber";
import { folder, useControls } from "leva";

export function PinesScatter() {
    return <GridScatter
        name={"Pines"}
        cellCount={30}
        scale={2}
        spacing={8}
        rotation_random={1}
        offset_random={1}
        visible={true}
    >
        <SnapToTerrainHeightCPU>
            <TransformsBufferProvider>
                <WrapAroundPlayerGPU />
                <InstancedMeshSimple>
                    {1 && <GLTFGeometry url="models/PineTree.glb" />}
                    <PinesMaterial />
                </InstancedMeshSimple>
            </TransformsBufferProvider>
        </SnapToTerrainHeightCPU>
    </GridScatter >
}


export function PinesMaterial( { color = "#738b8b" } ) {
    const { transformsBufferNode } = useTransformsBuffer();
    const terrain = useTerrain();
    const player = usePlayer();
    const grid = useGrid();

    const defaultColor = new THREE.Color(color);
    const controlled = useControls("Terrain", {
        "Pines": folder({
            "Material": folder({
                color: { value: color }
            })
        }, { collapsed: true })
    });

    const uniforms = useMemo(
        () => ({
            color: uniform(vec3(defaultColor.r, defaultColor.g, defaultColor.b)),
        }),
        []
    );

    // Update Uniforms
    useEffect(() => {
        const c = new THREE.Color(controlled.color);
        uniforms.color.value.set(c.r, c.g, c.b);
    }, [controlled.color])



    const texture_map = useLoader(THREE.TextureLoader, "models/PineTree.png");
    texture_map.wrapS = THREE.RepeatWrapping;
    texture_map.wrapT = THREE.RepeatWrapping;
    texture_map.colorSpace = THREE.NoColorSpace;
    texture_map.minFilter = THREE.NearestFilter;
    texture_map.magFilter = THREE.NearestFilter;
    texture_map.generateMipmaps = false;


    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])

    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.side = THREE.DoubleSide

        // Texture 
        const tex = texture(texture_map, uv().oneMinus());

        // Calc Distance Mask
        const world_pivot = instanceMatrix.mul(vec4(0, 0, 0, 1));
        const start_dist = 0.75;
        const dist_mask_pow = 1;
        const distance_mask = remapFromMin(length(world_pivot.sub(player.tsl_PlayerWorldPosition).xz).div(grid.gridSize * 0.5), start_dist).oneMinus().pow(dist_mask_pow);

        // Calculate Position
        const pos_ws = instanceMatrix.mul(vec4(positionLocal, 1));
        mat.positionNode = pos_ws;

        // Calculate Normal
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);

        //Dithered Alpha
        const threshold = rand(screenUV.xy);
        //const threshold = rand(positionLocal);
        //const circle_tres = screenUV.mul(50).mul(vec2(screenSize.x.div(screenSize.y),1.0)).fract().sub(0.5).length();        
        const alpha = step(threshold, distance_mask);
        mat.maskNode = alpha.mul(tex.r);
        //mat.transparent = true;
        mat.alphaTest = 0.5;

        mat.colorNode = vec3(0);
        //mat.colorNode = tex.gggr.mul(vertexColor()).mul(1.0).mul(uniforms.color);
        mat.emissiveNode = tex.gggr.mul(vertexColor()).mul(1.0).mul(uniforms.color).mul(1.00);

        return mat;
    }, [instanceMatrix, terrain.tsl_sampleHeight, terrain.tsl_sampleN, player.tsl_PlayerWorldPosition, terrain.tsl_sampleColor, grid.gridSize]);

    return <primitive object={material} attach="material" />
}
