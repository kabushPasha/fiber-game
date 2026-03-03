
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { modelWorldMatrix, positionLocal, vec3, vec4, texture, vec2, float, inverse, modelWorldMatrixInverse, transformNormalToView } from "three/tsl";
import { useTerrain } from "./TerrainProvider";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export function Terrain() {
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

    const { hf_size, width, height, hf_tex, hf_height, hf_nml } = useTerrain();

    const block_size = hf_size / (width - 1);
    const n_blocks = 1024 * 2 + 1;
    const size = block_size * (n_blocks);


    useFrame(() => {
        const parent = ref.current.parent!;
        ref.current.position.setX(-parent.position.x % block_size);
        ref.current.position.setZ(-parent.position.z % block_size);
    });


    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial();

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1));
        const samplePos = worldPos.div(hf_size).add(-0.5).zx.mul(vec2(1, -1));
        const heightSample = texture(hf_tex, samplePos).x;

        // modify world position
        const new_pos = worldPos.setY(heightSample.mul(hf_height).add(0.001));

        // convert back to local
        const localPos = modelWorldMatrixInverse.mul(new_pos).xyz;
        mat.positionNode = localPos;
        //mat.colorNode = heightSample;

        //mat.colorNode = heightSample;
        //mat.wireframe = true;

        const normalMap = texture(hf_nml, samplePos);
        const normalTS = normalMap.mul(2.0).sub(1.0);

        mat.normalNode = transformNormalToView(normalTS);
        


        //mat.colorNode = normalTS;

        return mat;
    }, []);


    return (
        <group name="TerrainPlane" ref={ref}>
            <mesh rotation-x={-Math.PI / 2} material={material}>
                {1 && <planeGeometry args={[size, size, n_blocks, n_blocks]} />}


            </mesh>
        </group>
    );
}