
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { modelWorldMatrix, positionLocal, vec3, vec4, texture, vec2, modelWorldMatrixInverse, transformNormalToView, instanceIndex, float, mix, uniform } from "three/tsl";
import { useTerrain } from "./TerrainProvider";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

import { usePlayer } from "../Player/PlayerContext";
import { folder, useControls } from "leva";


export function TerrainRapier() {
    const { heights, width, height, hf_height, hf_size, hf_tex } = useTerrain();

    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();

        const worldPos = modelWorldMatrix
            .mul(vec4(positionLocal, 1))
            .div(hf_size)
            .add(-0.5);

        const heightSample = texture(hf_tex, worldPos.zx.mul(vec2(1, -1))).x;

        mat.positionNode = positionLocal.add(vec3(0, 0, heightSample.mul(hf_height)));
        mat.colorNode = heightSample;
        mat.wireframe = true;

        return mat;
    }, [hf_size, hf_height, hf_tex]);

    return (
        <>
            <RigidBody type="fixed">
                <HeightfieldCollider
                    args={[
                        height - 1,
                        width - 1,
                        heights,
                        { x: hf_size, y: hf_height, z: hf_size },
                    ]}
                />
            </RigidBody>

            {0 && <mesh rotation-x={-Math.PI / 2} material={material}>
                <planeGeometry args={[hf_size, hf_size, width - 1, height - 1]} />
            </mesh>}

        </>
    );
}



export function TerrainPlane() {
    const ref = useRef<THREE.Group>(null!);

    const { hf_size, width, hf_tex, hf_height, hf_nml, tsl_sampleColor, tsl_sampleHeight, tsl_sampleN } = useTerrain();

    const block_size = hf_size / (width - 1) * 1.0;
    const n_blocks = 1024 + 1;
    const size = block_size * (n_blocks);


    useFrame(() => {
        const parent = ref.current.parent!;
        ref.current.position.setX(-parent.position.x % block_size);
        ref.current.position.setZ(-parent.position.z % block_size);
    });


    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();
        mat.side = THREE.DoubleSide

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1));
        const heightSample = tsl_sampleHeight(worldPos);
        const new_pos = worldPos.setY(heightSample);
        const localPos = modelWorldMatrixInverse.mul(new_pos).xyz;
        mat.positionNode = localPos;

        //mat.colorNode = heightSample;
        //mat.wireframe = true;

        mat.normalNode = transformNormalToView(tsl_sampleN(worldPos).mul(2.0).sub(1.0).xyz);
        mat.colorNode = tsl_sampleColor(worldPos);

        return mat;
    }, [hf_size, width, hf_tex, hf_height, hf_nml, tsl_sampleColor, tsl_sampleHeight, tsl_sampleN]);


    return (
        <group name="TerrainPlane" ref={ref} >
            <mesh rotation-x={-Math.PI / 2} material={material} receiveShadow name="TerrainPlaneMesh" raycast={() => { }}>
                {1 && <planeGeometry args={[size, size, n_blocks, n_blocks]} />}
            </mesh>
        </group>
    );
}






export function TerrainMoss() {
    const ref = useRef<THREE.Group>(null!);

    const { hf_size, width, hf_tex, hf_height, hf_nml, tsl_sampleColor, tsl_sampleHeight, tsl_sampleN } = useTerrain();

    const controlled = useControls("Terrain", {
        "Moss": folder({
            offset: { value: 0.35, min: 0, max: 5 },
            tile: { value: 0.5, min: 0, max: 2 },
            blocks: { value: 64, min: 0, max: 2048 },
            count: { value: 32, min: 0, max: 128 },
            color: { value: "#9ec9a2" },
        }, { collapsed: true })
    });


    const block_size = hf_size / (width - 1) * 1;
    const n_blocks = useMemo(() => {
        return controlled.blocks * 2 + 1;
    }, [controlled.blocks]);
    const size = block_size * (n_blocks);

    const count = useMemo(() => { return controlled.count }, [controlled.count]);
    const player = usePlayer();

    useFrame(() => {
        const pwp = player.playerWorldPosition;
        ref.current.position.setX(pwp.x - pwp.x % block_size);
        ref.current.position.setZ(pwp.z - pwp.z % block_size);
    }, -30);



    const uniforms = useMemo(
        () => ({
            offset: uniform(float(0.25)),
            tile: uniform(float(0.75)),
            color: uniform(vec3(1.0)),
        }),
        []
    );

    useEffect(() => {
        uniforms.offset.value = controlled.offset;
        uniforms.tile.value = controlled.tile;
    }, [controlled])


    // Update Uniforms
    useEffect(() => {
        const c = new THREE.Color(controlled.color);
        uniforms.color.value.set(c.r, c.g, c.b);
    }, [controlled.color])


    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();
        mat.side = THREE.DoubleSide

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1));

        const heightSample = tsl_sampleHeight(worldPos);
        const N = tsl_sampleN(worldPos).mul(2.0).sub(1.0).xzy;

        // Offset of index slice
        const w = float(instanceIndex.add(1)).div(count);

        const new_pos = worldPos.setY(heightSample).add(vec4(N.mul(uniforms.offset).mul(w), 0.0));
        const localPos = modelWorldMatrixInverse.mul(new_pos).xyz;
        mat.positionNode = localPos;


        //mat.wireframe = true;

        mat.normalNode = transformNormalToView(N.xzy);

        const hf_tex = useLoader(THREE.TextureLoader, "textures/noises/simple_moss.png");
        hf_tex.wrapS = THREE.RepeatWrapping;
        hf_tex.wrapT = THREE.RepeatWrapping;
        hf_tex.colorSpace = THREE.NoColorSpace;
        hf_tex.generateMipmaps = false;
        const height = texture(hf_tex, worldPos.xz.mul(uniforms.tile));
        mat.maskNode = height.x.sub(w).greaterThan(0);



        // Sample Noise Value
        //const tile = 10.0;        
        //const noise_val = rand(floor(worldPos.xz.mul(tile))).pow(.5);

        mat.colorNode = mix(tsl_sampleColor(worldPos), uniforms.color, w.pow(1).mul(0.5));


        //const tile_uv = fract( worldPos.xz.mul(tile));        
        //const center_distance = tile_uv.sub(0.5).mul(2.0).length().pow(1.0);

        //mat.maskNode = step(center_distance,noise_val.sub(w).max(0.0).pow(.5));        
        //mat.alphaTest = 0.8;


        return mat;
    }, [hf_size, width, hf_tex, hf_height, hf_nml, tsl_sampleColor, tsl_sampleHeight, tsl_sampleN, count, uniforms]);

    return (
        <group name="TerrainPlane" ref={ref} >
            {false && <mesh rotation-x={-Math.PI / 2} material={material} receiveShadow name="TerrainPlaneMesh" raycast={() => { }}>
                {1 && <planeGeometry args={[size, size, n_blocks, n_blocks]} />}
            </mesh>}

            <instancedMesh
                frustumCulled={false}
                args={[undefined, material, count]}
                rotation-x={-Math.PI / 2}
            >
                {1 && <planeGeometry args={[size, size, n_blocks, n_blocks]} />}

            </instancedMesh>
        </group>
    );
}



export function TerrainMossUI() {
    const controlled = useControls("Terrain", {
        "Moss": folder({
            enabled: { value: true },
        }, { collapsed: true })
    });

    if (!controlled.enabled) return null;

    return <TerrainMoss />
}