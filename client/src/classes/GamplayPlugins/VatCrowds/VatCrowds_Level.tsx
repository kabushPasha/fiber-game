
import * as THREE from "three/webgpu"
import { Pixelated } from "../../../components/Pixelated"
import { TerrainProvider, useTerrain } from "../../Terrain/TerrainProvider"
import { Player } from "../../Player/Player"
import { ParentWorldPositionConstraint } from "../../ParentConstraints/ParentWorldPositionConstraint"
import { GroundClamp, Jump, MoveByVel } from "../../Player/PlayerPhysics"
import { ImmortalLeva, Knight } from "../../LEVELS/Assets/Characters/Knight"
import { GrassScatter, GridScatter, InstancedMeshSimple, TransformsBufferProvider, useTransformsBuffer, WrapAroundPlayerGPU } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides"
import { PinesScatter } from "../../Terrain/ScatterAPI/Scatter/Presets"
import { SimpleBackground } from "../../shaders/Aurora"
import { useEffect, useMemo, useRef } from "react"
import { atomicLoad, deltaTime, float, Fn, If, instanceIndex, int, ivec2, mix, modelWorldMatrix, modelWorldMatrixInverse, normalLocal, positionLocal, texture, uniform, vec3, vec4, vertexColor } from "three/tsl"
import { useFrame, useLoader } from "@react-three/fiber"
import { folder, useControls } from "leva"
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow"
import { usePlayer } from "../../Player/PlayerContext"
import { NeighbourGrid2D } from "../../Terrain/ECS/NbrGrid2D"
import { useVatCharLoader } from "./VatLoader"
import { CameraUniformsProvider } from "../../PostProcessing/cameraUniformsContext"
import { WebGPUPostProcessingProvider } from "../../PostProcessing/PostProcessingContext"
import { PP_Sharpen } from "../../PostProcessing/Effects/PP_Sharpen"
import { PP_Vignette } from "../../PostProcessing/Effects/PP_Dof"
import { PP_Kuwahara } from "../../PostProcessing/Effects/Kuwahara/PP_SimpleKuwahara"
import { Helper, useGLTF } from "@react-three/drei"
import { RingBufferTest } from "./RingBuffer"


type VatCharacterProps = {
    count?: number;
    offset?: number;
    url?: string;
};


export function Vat_Character({
    count,
    offset = 0,
    url = "models/Char/VatChar/BigK.glb",
}: VatCharacterProps) {

    const controlled = useControls("FRAME", {
        frame: { value: 0.0, min: 0, max: 24, step: 1.0 },
    });

    const uniforms = useMemo(
        () => ({
            frame: uniform(int(0)),
        }),
        []
    );

    useEffect(() => {
        uniforms.frame.value = controlled.frame;
    }, [controlled])

    const vatChar = useVatCharLoader(url);

    const { transformsBufferNode } = useTransformsBuffer();
    const instanceMatrix = useMemo(() => { return transformsBufferNode.element(instanceIndex.add(offset)) }, [transformsBufferNode, offset])

    const [mat, outline_material, shadow_material] = useMemo(() => {
        const [material, outline_material] = vatChar.simple_materials({ instanceMatrix, clip: int(1) });
        const shadow_material = new THREE.MeshStandardNodeMaterial();

        shadow_material.colorNode = outline_material.colorNode;
        shadow_material.positionNode = outline_material.positionNode!.setY(float(0))
            .add(vec3(outline_material.positionNode!.y.mul(-0.5), 0, 0));


        return [material, outline_material, shadow_material];
    }, [vatChar.map, vatChar.vatLoader, uniforms, instanceMatrix]);


    return <>
        <InstancedMeshSimple geometry={vatChar.geometry} material={mat} count={count} />
        { 1 && <InstancedMeshSimple geometry={vatChar.geometry} material={outline_material} count={count} castShadow={false}/>}
        { 1 && <InstancedMeshSimple geometry={vatChar.geometry} material={shadow_material} count={count} />}
    </>
}

export function VatCharacterScatter() {


    return <GridScatter
        name={"Warriors"}
        spacing={10}
        cellCount={30}
        scale={2}
        rotation_random={1}
        offset_random={3}
        scale_random={0.3}
        shuffele={true}
    >
        <TransformsBufferProvider>
            <Vat_Character count={700} />
            <Vat_Character count={200} offset={700} url="models/Char/VatChar/OrkKing.glb" />

            <MoveByOrient speed={3} />

            <WrapAroundPlayerGPU />

            <NgbGrid_Collide />

        </TransformsBufferProvider>
    </GridScatter>
}

export function MoveByOrient({ speed = 3 }) {
    const renderer = useWebGPURenderer()
    const { transformsBufferNode, count } = useTransformsBuffer();

    const player = usePlayer()

    const instanceMatrix = useMemo(() => {
        return transformsBufferNode.element(instanceIndex)
    }, [transformsBufferNode])

    // update Fn
    const computeUpdate = useMemo(() => {
        return Fn(() => {
            const worldPos = instanceMatrix.mul(vec4(0, 0, 0, 1));
            const offset = instanceMatrix.element(int(3));
            const forward = instanceMatrix.mul(vec4(0, 0, 1, 0)).normalize();

            // Move
            offset.assign(offset.add(forward.mul(deltaTime.mul(speed))));

            // Rotate Towards Player            
            const toPlayer = player.tsl_PlayerWorldPosition.sub(worldPos.xyz).setY(float(0)).normalize();

            const turnSpeed = deltaTime.mul(5);
            const newForward = mix(forward.xyz, toPlayer, turnSpeed).setY(float(0)).normalize();

            const up = vec3(0, 1, 0);
            const right = up.cross(newForward).normalize();

            const rightCol = instanceMatrix.element(int(0));
            const upCol = instanceMatrix.element(int(1));
            const forwardCol = instanceMatrix.element(int(2));

            const scaleX = rightCol.length();
            const scaleY = upCol.length();
            const scaleZ = forwardCol.length();

            instanceMatrix.element(int(0)).assign(vec4(right, 0).mul(scaleX));
            instanceMatrix.element(int(1)).assign(vec4(up, 0).mul(scaleY));
            instanceMatrix.element(int(2)).assign(vec4(newForward, 0).mul(scaleZ));

        })().compute(count);
    }, [instanceMatrix, count, player.tsl_PlayerWorldPosition, speed]);


    useFrame(() => { renderer.compute(computeUpdate) })

    return null;
}

type NgbGridCollideProps = {
    size?: number
    cells?: number
    max_nbrs?: number
    radius?: number
    strength?: number
    show_debug_mesh?: boolean
    follow_player?: boolean
}

export function NgbGrid_Collide({
    size = 100,
    cells = 20,
    max_nbrs = 16 * 2,
    radius = 2.0,
    strength = 0.2,
    show_debug_mesh = false,
    follow_player = true,
}: NgbGridCollideProps) {
    const [controls, set] = useControls(() => ({
        NBR_Grid: folder({
            size: { value: size, min: 10, max: 500, step: 5.0 },
            cells: { value: cells, min: 1, max: 256, step: 1 },
            max_nbrs: { value: max_nbrs, min: 1, max: 512, step: 1 },
            show_debug_mesh: show_debug_mesh,
            follow_player: follow_player,
            Physics: folder({
                radius: { value: radius, min: 0.1, max: 10.0, step: 0.1 },
                strength: { value: strength, min: 0.0, max: 5.0, step: 0.01 },
            }),
        })
    }));

    useEffect(() => {
        set({ size, cells, max_nbrs, radius, strength, show_debug_mesh, follow_player, });
    }, [size, cells, max_nbrs, radius, strength, show_debug_mesh, follow_player, set]);

    const renderer = useWebGPURenderer();
    const transformsBuffer = useTransformsBuffer();
    const player = usePlayer();

    const nbr_grid = useMemo(() => {
        return new NeighbourGrid2D(
            controls.size,
            controls.cells,
            controls.max_nbrs
        )
    }, [controls.size, controls.cells, controls.max_nbrs])

    const uniforms = useMemo(
        () => ({
            radius: uniform(float(2.0)),
            strength: uniform(float(0.2)),
        }),
        []
    );
    useEffect(() => {
        uniforms.radius.value = controls.radius;
        uniforms.strength.value = controls.strength;
    }, [controls.radius, controls.strength])


    // Write Particle to grid
    const fillGridCompute = useMemo(() => {
        return Fn(() => {
            If(instanceIndex.lessThan(transformsBuffer.count), () => {
                const instanceMatrix = transformsBuffer.transformsBufferNode.element(instanceIndex)
                const offset = instanceMatrix.element(int(3))
                nbr_grid.insertParticle(offset, instanceIndex)
            })
        })().compute(transformsBuffer.count);
    }, [nbr_grid, transformsBuffer])

    // Compute PBD
    const pbdCompute = useMemo(() => {
        return pbdRepelCompute(
            transformsBuffer.transformsBufferNode,
            nbr_grid,
            transformsBuffer.count,
            uniforms.radius,
            uniforms.strength
        ).compute(transformsBuffer.count);
    }, [nbr_grid, transformsBuffer, uniforms])

    // Follow player
    useEffect(() => {
        if (controls.follow_player) nbr_grid.gridCenterUniform.value = player.playerWorldPosition;
        else nbr_grid.gridCenterUniform.value = new THREE.Vector3(0.0);
    }, [controls.follow_player, player])

    useFrame(async () => {
        await renderer.computeAsync(nbr_grid.clearCompute())
        await renderer.computeAsync(fillGridCompute)
        await renderer.computeAsync(nbr_grid.computeMirror())
        await renderer.computeAsync(pbdCompute)
    })

    if (!controls.show_debug_mesh) return null
    return (
        <primitive object={nbr_grid.createDebugMesh()} />
    )
}

export const pbdRepelCompute = Fn((
    [transformsBuffer, grid, count, radius, strength]: [THREE.StorageBufferNode, NeighbourGrid2D, THREE.UniformNode<number>, number, number]
) => {
    If(instanceIndex.lessThan(count), () => {
        const self = transformsBuffer.element(instanceIndex)
        const pos = self.element(int(3))

        const cell2 = grid.posToIndex2TSL(pos)
        const correction = vec3(0).toVar("OffsetCorrection")

        const size = 1;

        for (let oy = -size; oy <= size; oy++) {
            for (let ox = -size; ox <= size; ox++) {

                const neighborCell2 = cell2.add(ivec2(ox, oy));
                const linear = grid.index2ToLinearTSL(neighborCell2)
                const base = grid.getCellBaseIndex(linear)

                // iterate fixed max per cell
                const countInCell = atomicLoad(grid.gridCounts.element(linear))
                for (let i = 0; i < grid.maxPerCell; i++) {
                    If(int(i).lessThan(countInCell), () => {
                        const otherIndex = grid.gridParticles.element(base.add(int(i)))
                        const otherMatrix = transformsBuffer.element(otherIndex)
                        const otherPos = otherMatrix.element(int(3))

                        const dir = pos.xyz.sub(otherPos.xyz).mul(vec3(1, 0, 1))
                        const dist = dir.length()

                        If(otherIndex.notEqual(instanceIndex), () => {

                            If(dist.lessThan(float(radius)), () => {
                                const push = dir.normalize()
                                    .mul(float(radius).sub(dist))
                                    .mul(strength)
                                correction.addAssign(push)
                            })
                        })
                    })
                }
            }
        }

        // apply correction
        const offset = self.element(int(3))
        offset.addAssign(vec4(correction, 0.0))
    })
})

export function VatCrowds_Level() {

    return <>

        <Pixelated resolution={512} enabled={true} />

        <CameraUniformsProvider>
            <WebGPUPostProcessingProvider >
                <PP_Vignette />
                {0 && <>
                    <PP_Sharpen kernelSize={1} strength={0.1} enabled={false} />
                    <PP_Kuwahara />
                </>}
            </WebGPUPostProcessingProvider>
        </CameraUniformsProvider>


        <TerrainProvider textureUrl="textures/HFs/height.png" hf_height={0}>

            <Player camera_props={{ defaultZ: 40, default_pitch: 45, default_yaw: 180, head_y: 2.75 }} show_sphere={false}>
                <ParentWorldPositionConstraint>

                </ParentWorldPositionConstraint>
                {1 && <MoveByVel speed={0.5} />}
                {0 && <Jump />}
                <GroundClamp />

                {0 && <Knight />}
                <ImmortalLeva />
            </Player>

            {1 && <>
                {0 && <GrassScatter />}
                {0 && <PinesScatter />}
            </>}

            {/** <Vat_Character />*/}
            {1 && <VatCharacterScatter />}


            {/** <Vat_Character />*/}
            {1 && <TexturedTerrain />}

            {0 && <LowPolyMolly />}

            {0 && <RingBufferTest />}



            {0 && <PlayerFollowingLightWithShadows />}


        </TerrainProvider>

        {0 && <SimpleBackground />}
    </>
}





export default function PlayerFollowingLightWithShadows() {
    const lightRef = useRef<THREE.DirectionalLight>(null!);

    const offset = new THREE.Vector3(50, 50, 0);
    const player = usePlayer()

    const renderer = useWebGPURenderer()

    useEffect(() => {
        const cam = lightRef.current.shadow.camera;
        cam.zoom = 0.05;
        cam.updateProjectionMatrix();

        console.log(lightRef.current.shadow);
        const shadow_res = 512;
        lightRef.current.shadow.mapSize.width = shadow_res;
        lightRef.current.shadow.mapSize.height = shadow_res;
        lightRef.current.shadow.blurSamples = 1;

        renderer.shadowMap.type = 0;
        console.log("Renderer", renderer);

        //lightRef.current.shadow.map!.depthTexture!.magFilter = THREE.LinearFilter;
        //lightRef.current.shadow.map!.depthTexture!.minFilter = THREE.LinearFilter;

        const pars = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        };

        lightRef.current.shadow.map = new THREE.WebGLRenderTarget(shadow_res,shadow_res, pars);



    }, [])

    useFrame(() => {
        if (player.player == null) return;
        lightRef.current.position.copy(player.playerWorldPosition.add(offset));
        lightRef.current.target = player.player;


    })

    return <>
        <ambientLight intensity={0.0} />
        <directionalLight castShadow position={offset} ref={lightRef} intensity={2.0}>
            <orthographicCamera attach='shadow-camera'>
                <Helper type={THREE.CameraHelper} />
            </orthographicCamera>
        </directionalLight>
    </>
}

// Low Poly Model TEst
export function LowPolyMolly() {

    // Load GLTF
    const gltf_model = useGLTF("models/Char/LowPoly/LowPollyMech1.glb")
    // Get first meshas
    const mesh = useMemo(() => { return gltf_model.meshes[Object.keys(gltf_model.meshes)[0]] }, [gltf_model])
    const geometry = useMemo(() => mesh.geometry, [mesh]);

    const [mat, outline_material, shadow_material] = useMemo(() => {
        const material = new THREE.MeshStandardNodeMaterial();
        const outline_material = new THREE.MeshStandardNodeMaterial();
        const shadow_material = new THREE.MeshStandardNodeMaterial();
        material.side = THREE.DoubleSide;
        material.colorNode = vec3(0.0);
        material.emissiveNode = vertexColor().mul(0.5);
        //material.colorNode = vertexColor().mul(2);


        outline_material.side = THREE.BackSide;
        outline_material.colorNode = vec3(0.0);


        outline_material.positionNode = positionLocal.add(normalLocal.mul(0.03));

        shadow_material.colorNode = outline_material.colorNode;
        shadow_material.positionNode = outline_material.positionNode!.setY(float(0)).add(vec3(outline_material.positionNode!.y.mul(0.5), 0, 0));


        return [material, outline_material, shadow_material];
    }, []);

    return <>
        <mesh scale={2} geometry={geometry} material={mat} />
        <mesh scale={2} geometry={geometry} material={outline_material} />
        <mesh scale={2} geometry={geometry} material={shadow_material} />
    </>
}



// Split this class into different pieces:
export function TexturedTerrain() {
    const ref = useRef<THREE.Group>(null!);

    const { hf_size, width, hf_tex, hf_height, hf_nml, tsl_sampleColor, tsl_sampleHeight, tsl_sampleN } = useTerrain();

    //const block_size = hf_size / (width - 1) * 1.0;
    const block_size = 0.2;
    const n_blocks = 1024 + 1;
    const size = block_size * (n_blocks);

    const player = usePlayer()

    useFrame(() => {
        ref.current.position.setX(player.playerWorldPosition.x - player.playerWorldPosition.x % block_size);
        ref.current.position.setZ(player.playerWorldPosition.z - player.playerWorldPosition.z % block_size);
    }, -10);

    const controlled = useControls("TerrainTex", {
        noiseAmp: { value: 5.0, min: 0, max: 10, step: .01 },
        stepCenter: { value: -1.0, min: -5, max: 5, step: .01 },
        stepSmooth: { value: 2.0, min: 0.0, max: 5, step: .01 },
        parallax_height: { value: 0.5, min: 0.0, max: 1.0, step: .001 },
    });

    const uniforms = useMemo(
        () => ({
            noiseAmp: uniform(float(0)),
            stepCenter: uniform(float(0)),
            stepSmooth: uniform(float(0)),
            parallax_height: uniform(float(0)),
        }),
        []
    );

    useEffect(() => {
        uniforms.noiseAmp.value = controlled.noiseAmp;
        uniforms.stepCenter.value = controlled.stepCenter;
        uniforms.stepSmooth.value = controlled.stepSmooth;
        uniforms.parallax_height.value = controlled.parallax_height;
    }, [controlled])

    const tile_tex1 = chsTileTex({
        url: "textures/ENV/Ground_tile/Env_Rock.512.png",
        tile_size: 30,
        height_amp: 5,
        height_offset: -2,
        shadow_mix: 0.7,
        contrast: 0.5,
        tint: "#ffcfb1"
    })
    const tile_tex2 = chsTileTex({
        url: "textures/ENV/Ground_tile/Env_Desert.512.png",
        tile_size: 40,
        height_amp: 5,
        height_offset: -1.75,
        shadow_mix: 0.7,
        contrast: 1.0,
        tint: "#ffcdae"
    })

    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.side = THREE.DoubleSide

        mat.colorNode = vec3(0.0);


        // NEW WAY
        mat.emissiveNode = tile_tex2.sample_color_wp;
        mat.positionNode = tile_tex2.lp_final;

        mat.positionNode = height2localP(tile_tex1.height.max(tile_tex2.height));
        mat.emissiveNode = tile_tex1.height.max(tile_tex2.height);

        const mask = delta_height_mask(tile_tex1.height, tile_tex2.height, uniforms.parallax_height);
        const mixed_cd = mask.mix(tile_tex1.sample_color_wp, tile_tex2.sample_color_wp);
        mat.emissiveNode = mixed_cd.mul(0.5);

        //mat.emissiveNode = vec3(0.0);
        //mat.colorNode = mixed_cd;

        //mat.positionNode = positionLocal.sub(vec3(0,0,0.1));


        /*
        const base_tex = mixed_cd;
        const big_noise = texture(tex, worldPos.xz.div(150)).y;
        const A = base_tex.length().oneMinus().pow(uniforms.stepSmooth);
        const B = big_noise.mul(uniforms.noiseAmp).add(uniforms.stepCenter).clamp(0., 1.0);
        const burned = B.equal(0.0).select(0.0, A.negate().add(1.0).div(B).negate().add(1)).clamp(0.0, 1.0);
        const burned_cd = mix(base_tex, base_tex.mul(vec3(.1, 0.1, 0.1)), burned.mul(1));
        mat.emissiveNode = burned_cd;*/



        return mat;
    }, [hf_size, width, hf_tex, hf_height, hf_nml, tsl_sampleColor, tsl_sampleHeight, tsl_sampleN, uniforms, tile_tex1, tile_tex2]);


    return (
        <group name="TerrainPlane" ref={ref} >
            <mesh rotation-x={-Math.PI / 2} material={material} receiveShadow name="TerrainPlaneMesh" raycast={() => { }}>
                <planeGeometry args={[size, size, n_blocks, n_blocks]} />
            </mesh>
        </group>
    );
}

const height2localP = Fn(([height]: [THREE.Node]) => {
    const wp = modelWorldMatrix.mul(vec4(positionLocal, 1));
    const new_wp = wp.setY(height);
    return modelWorldMatrixInverse.mul(new_wp).xyz;
});

const delta_height_mask = Fn(([h1, h2, w]: [THREE.Node, THREE.Node, THREE.Node]) => {
    return h2.sub(h1).add(w.mul(0.5)).div(w).clamp(0, 1).smoothstep(0, 1);
})




// -------- CHS TEXTURE ------------------

const CHS_Textures = {
    "Env_Rock.512.png": "textures/ENV/Ground_tile/Env_Rock.512.png",
    "Env_Rock.png": "textures/ENV/Ground_tile/Env_Rock.png",
    "Env_Desert.png": "textures/ENV/Ground_tile/Env_Desert.png",
    "Env_Desert.512.png": "textures/ENV/Ground_tile/Env_Desert.512.png",
}


type chsTileTexProps = {
    url: string;
    tile_size?: number;
    height_amp?: number;
    height_offset?: number;
    shadow_mix?: number;
    contrast?: number;
    tint?: string;
};

const default_chsTileTexProps: chsTileTexProps = {
    url: "textures/ENV/Ground_tile/Env_Rock.png",
    tile_size: 20,
    height_amp: 1.0,
    height_offset: 0.0,
    shadow_mix: 0.5,
    contrast: 1.0,
    tint: "#ff8844",
};

const chsTileTex = (_props: chsTileTexProps) => {
    const props = { ...default_chsTileTexProps, ..._props };

    // filename without extension
    const name = useMemo(() => {
        const file = props.url.split('/').pop() ?? "Texture";
        return file.split('.').slice(0, -1).join('.');
    }, [props.url]);

    const [controlled, set] = useControls(() => ({
        TerrainTex: folder({
            [name]: folder({
                url: { value: props.url, options: CHS_Textures },
                tile_size: { value: props.tile_size!, min: 1, max: 50, step: .01 },
                height_amp: { value: props.height_amp!, min: 0.0, max: 5.0, step: .01 },
                height_offset: { value: props.height_offset!, min: -2.0, max: 2.0, step: .01 },
                shadow_mix: { value: props.shadow_mix!, min: 0.0, max: 1.0, step: .01 },
                contrast: { value: props.contrast!, min: 0.0, max: 3.0, step: .01 },
                tint: "#ff8844",
            })
        })
    }));

    const tex = useLoader(THREE.TextureLoader, controlled.url);

    useEffect(() => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
    }, [controlled.url])


    useEffect(() => {
        set({
            tile_size: props.tile_size,
            height_amp: props.height_amp,
            height_offset: props.height_offset,
            shadow_mix: props.shadow_mix,
            contrast: props.contrast,
            tint: props.tint,
        });
    }, [props.tile_size, props.height_amp, props.height_offset, props.shadow_mix, props.contrast, props.tint, set]);

    const uniforms = useMemo(
        () => ({
            tile_size: uniform(float(20.0)),
            height_amp: uniform(float(1)),
            height_offset: uniform(float(0)),
            shadow_mix: uniform(float(0)),
            contrast: uniform(float(1)),
            tint: uniform(new THREE.Color("#ffffff")),
        }),
        []
    );

    useEffect(() => {
        uniforms.tile_size.value = controlled.tile_size;
        uniforms.height_amp.value = controlled.height_amp;
        uniforms.height_offset.value = controlled.height_offset;
        uniforms.shadow_mix.value = controlled.shadow_mix;
        uniforms.contrast.value = controlled.contrast;
        uniforms.tint.value.set(controlled.tint);
    }, [controlled])

    const [sample_color_wp, height, lp_final, tex_sample] = useMemo(() => {

        const wp = modelWorldMatrix.mul(vec4(positionLocal, 1));
        const tex_sample = texture(tex, wp.xz.div(uniforms.tile_size));

        const color = uniforms.contrast.mix(0.5, tex_sample.x)
            .mul(uniforms.tint).
            mul(uniforms.shadow_mix.mix(1.0, tex_sample.z));
        const heihgt = tex_sample.y.mul(uniforms.height_amp).add(uniforms.height_offset);

        const new_wp = wp.setY(heihgt);
        const lp_final = modelWorldMatrixInverse.mul(new_wp).xyz;

        return [color, heihgt, lp_final, tex_sample];

    }, [tex, uniforms])

    const value = useMemo(() => ({
        tex,
        sample_color_wp,
        height,
        lp_final,
        tex_sample
    }), [tex, sample_color_wp, height, lp_final]);

    return value;
}
