
import * as THREE from "three/webgpu"
import { Pixelated } from "../../../components/Pixelated"
import { TerrainProvider } from "../../Terrain/TerrainProvider"
import { Player } from "../../Player/Player"
import { ParentWorldPositionConstraint } from "../../ParentConstraints/ParentWorldPositionConstraint"
import { TerrainPlane } from "../../Terrain/Terrain"
import { GroundClamp, Jump, MoveByVel } from "../../Player/PlayerPhysics"
import { ImmortalLeva, Knight } from "../../LEVELS/Assets/Characters/Knight"
import { GrassScatter, GridScatter, InstancedMeshSimple, TransformsBufferProvider, useTransformsBuffer, WrapAroundPlayerGPU } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides"
import { PinesScatter } from "../../Terrain/ScatterAPI/Scatter/Presets"
import { SimpleBackground } from "../../shaders/Aurora"
import { useEffect, useMemo } from "react"
import { attribute, deltaTime, float, Fn, instanceIndex, int, mix, normalLocal, positionLocal, storage, texture, time, uniform, uv, vec2, vec3, vec4 } from "three/tsl"
import { useGLTF, useTexture } from "@react-three/drei"
import { useFrame, useLoader } from "@react-three/fiber"
import { useControls } from "leva"
import { useWebGPURenderer } from "../../Effects/SimulationGrids/SatinFlow"
import { usePlayer } from "../../Player/PlayerContext"



export function parseAnimBin(anim_raw: ArrayBuffer) {
    const view = new DataView(anim_raw);

    let offset = 0;

    // 1. Basic header
    const bones = view.getUint32(offset, true);
    offset += 4;

    const numClips = view.getUint32(offset, true);
    offset += 4;

    // 2. Clip frames array
    const clipFrames: number[] = new Array(numClips);

    for (let i = 0; i < numClips; i++) {
        clipFrames[i] = view.getUint32(offset, true);
        offset += 4;
    }

    // 3. Build offsets (frame start per clip)
    const clipOffsets: number[] = new Array(numClips);

    let running = 0;
    for (let i = 0; i < numClips; i++) {
        clipOffsets[i] = running;
        running += clipFrames[i];
    }

    // 4. Remaining buffer = animation data (float16)
    const remainingBytes = anim_raw.byteLength - offset;
    const count = remainingBytes / 2;

    const data = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const uint16 = view.getUint16(offset + i * 2, true);
        data[i] = float16ToFloat32(uint16);
    }

    return {
        bones,
        numClips,
        clipFrames,
        clipOffsets,
        data,
    };
}



export function Vat_Character() {
    const map = useTexture("models/Char/VatChar/BigK.glb.png")
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = 'srgb'

    const gltf_model = useGLTF("models/Char/VatChar/BigK.glb")
    // Get first meshas
    const mesh = useMemo(() => { return gltf_model.meshes[Object.keys(gltf_model.meshes)[0]] }, [gltf_model])
    const num_bones_per_vt = useMemo(() => mesh.geometry.attributes._bone_i.itemSize, [mesh]);
    //const num_bones_per_vt = 3;

    //console.log(mesh);

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


    // Load Animation File
    const anim_raw = useLoader(
        THREE.FileLoader,
        "models/Char/VatChar/BigK.bin",
        async (loader) => { loader.setResponseType("arraybuffer") }
    ) as ArrayBuffer;
    // Parse
    const anim_parsed = useMemo(() => parseAnimBin(anim_raw), [anim_raw]);


    // Store Into Buffer
    const boneTransfomrsBufferAttribute = useMemo(() => {
        return new THREE.StorageInstancedBufferAttribute(anim_parsed.data, 16);
    }, [anim_parsed])
    const boneTransformsBufferNode = useMemo(() =>
        storage(boneTransfomrsBufferAttribute)
        , [boneTransfomrsBufferAttribute]);

    const animatedPosition = useMemo(() => {
        return Fn(([frame]: [THREE.Node]) => {
            const P = vec3(0.0).toVar();
            for (let i = 0; i < num_bones_per_vt; i++) {
                const bone_index = attribute(`_bone_i`).element(int(i));
                const bone_w = attribute(`_bone_w`).element(int(i));
                const t = boneTransformsBufferNode.element(bone_index.add(frame.mul(anim_parsed.bones)));
                const pos = vec4(positionLocal, 1.0).mul(t.transpose());
                P.addAssign(pos.mul(bone_w).xyz);
            }
            return P;
        });
    }, [num_bones_per_vt, boneTransformsBufferNode, anim_parsed.bones])


    const { transformsBufferNode } = useTransformsBuffer();
    const instanceMatrix = useMemo(() => { return transformsBufferNode.element(instanceIndex) }, [transformsBufferNode])


    const [mat, outline_material] = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();
        const flippedUV = vec2(uv().x, uv().y.oneMinus())
        const materialColor = texture(map, flippedUV);
        material.colorNode = materialColor.clamp(0, 1);

        const fps = 12;
        const clip = 1;
        const frame = time.mul(fps).floor().mod(anim_parsed.clipFrames[clip] - 1).add(anim_parsed.clipOffsets[clip]);
        //const frame = uniforms.frame.mod( anim_parsed.clipFrames[clip] - 1 ).add(anim_parsed.clipOffsets[clip]);

        material.positionNode = instanceMatrix.mul(animatedPosition(frame));

        // Outline Material
        const outline_material = new THREE.MeshBasicNodeMaterial();
        outline_material.side = THREE.BackSide;
        outline_material.positionNode = instanceMatrix.mul(animatedPosition(frame).add(normalLocal.mul(0.02)));
        outline_material.colorNode = vec3(0.0);


        return [material, outline_material];
    }, [map, boneTransformsBufferNode, anim_parsed, num_bones_per_vt, uniforms, instanceMatrix]);


    return <>
        <InstancedMeshSimple geometry={mesh.geometry} material={mat} />
        <InstancedMeshSimple geometry={mesh.geometry} material={outline_material} />
    </>

    //return <mesh scale={2} rotation={[0, Math.PI, 0]} material={customMaterial} geometry={mesh.geometry}/>;

}

export function VatCharacterScatter() {
    return <GridScatter
        name={"Warriors"}
        spacing={10}
        cellCount={20}
        scale={2}
        rotation_random={1}
        offset_random={0}
        scale_random={0.3}
    >
        <TransformsBufferProvider>
            <Vat_Character />

            <MoveByOrient />

            <WrapAroundPlayerGPU />


        </TransformsBufferProvider>
    </GridScatter>
}

export function MoveByOrient() {
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
            offset.assign(offset.add(forward.mul(deltaTime.mul(3))));

            // Rotate Towards Player
            const toPlayer = player.tsl_PlayerWorldPosition.sub(worldPos.xyz).setY( float(0) ).normalize();

            const turnSpeed = deltaTime.mul(5) ;
            const newForward = mix(forward.xyz, toPlayer ,turnSpeed).setY( float(0) ).normalize();

            const up = vec3(0,1,0);
            const right = up.cross(newForward).normalize();            

            const rightCol = instanceMatrix.element(int(0));
            const upCol = instanceMatrix.element(int(1));
            const forwardCol = instanceMatrix.element(int(2));
            
            const scaleX = rightCol.length();
            const scaleY = upCol.length();
            const scaleZ = forwardCol.length();

            instanceMatrix.element(int(0)).assign(vec4(right, 0) .mul(scaleX)  );
            instanceMatrix.element(int(1)).assign(vec4(up, 0) .mul(scaleY) );
            instanceMatrix.element(int(2)).assign(vec4(newForward, 0) .mul(scaleZ) );  

        })().compute(count);
    }, [instanceMatrix, count, player.tsl_PlayerWorldPosition]);


    useFrame(() => { renderer.compute(computeUpdate) })

    return null;
}


function float16ToFloat32(bits: number): number {
    const s = (bits & 0x8000) >> 15
    const e = (bits & 0x7C00) >> 10
    const f = bits & 0x03FF

    if (e === 0) {
        return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10))
    }

    if (e === 0x1F) {
        return f ? NaN : ((s ? -1 : 1) * Infinity)
    }

    return (
        (s ? -1 : 1) *
        Math.pow(2, e - 15) *
        (1 + f / Math.pow(2, 10))
    )
}


export function VatCrowds_Level() {

    return <>

        <Pixelated resolution={256} enabled={true} />

        <group name="Lights">
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 5, 0]} intensity={0.5} />
        </group>

        <TerrainProvider textureUrl="textures/HFs/height.png" hf_height={0}>

            <Player camera_props={{ defaultZ: 9, default_pitch: 15, default_yaw: 180, head_y: 2.75 }} show_sphere={false}>
                <ParentWorldPositionConstraint>
                    {1 && <TerrainPlane />}
                </ParentWorldPositionConstraint>
                {1 && <MoveByVel speed={0.5} />}
                <Jump />
                <GroundClamp />

                {0 && <Knight />}
                <ImmortalLeva />
            </Player>

            {1 && <>
                {0 && <GrassScatter />}
                {0 && <PinesScatter />}
            </>}

            {/** <Vat_Character />*/}
            <VatCharacterScatter />

        </TerrainProvider>

        {0 && <SimpleBackground />}
    </>
}

