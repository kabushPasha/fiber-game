
import * as THREE from "three/webgpu"
import { Pixelated } from "../../../components/Pixelated"
import { TerrainProvider } from "../../Terrain/TerrainProvider"
import { Player } from "../../Player/Player"
import { ParentWorldPositionConstraint } from "../../ParentConstraints/ParentWorldPositionConstraint"
import { TerrainPlane } from "../../Terrain/Terrain"
import { GroundClamp, Jump, MoveByVel } from "../../Player/PlayerPhysics"
import { ImmortalLeva, Knight } from "../../LEVELS/Assets/Characters/Knight"
import { GrassScatter } from "../../Terrain/ScatterAPI/Scatter/TransformsProvides"
import { PinesScatter } from "../../Terrain/ScatterAPI/Scatter/Presets"
import { SimpleBackground } from "../../shaders/Aurora"
import { useEffect, useMemo } from "react"
import { attribute, Fn, int, positionLocal, storage, texture, time, uniform, uv, vec2, vec3, vec4 } from "three/tsl"
import { useGLTF, useTexture } from "@react-three/drei"
import { useLoader } from "@react-three/fiber"
import { useControls } from "leva"




export function Vat_Character() {

    const map = useTexture("models/Char/VatChar/BigK.glb.png")
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = 'srgb'

    const gltf_model = useGLTF("models/Char/VatChar/BigK.glb")
    // Get first meshas
    const mesh = useMemo(() => { return gltf_model.meshes[Object.keys(gltf_model.meshes)[0]] }, [gltf_model])
    const num_bones_per_vt = useMemo(() => Object.keys(mesh.geometry.attributes).filter(name => name.startsWith("_bone_i_")).length, [mesh])

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

    // Parse binary
    const anim_parsed = useMemo(() => {
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
    }, [anim_raw]);


    console.log(anim_parsed);



    // Store Into Buffer
    const transfomrsBufferAttribute = useMemo(() => {
        return new THREE.StorageInstancedBufferAttribute(anim_parsed.data, 16);
    }, [anim_parsed])
    const transformsBufferNode = useMemo(() =>
        storage(transfomrsBufferAttribute)
        , [transfomrsBufferAttribute]);

    const customMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();
        const flippedUV = vec2(uv().x, uv().y.oneMinus())
        const materialColor = texture(map, flippedUV);
        material.colorNode = materialColor.clamp(0, 1);

        const fps = 12;
        const clip = 0;
        const frame = time.mul(fps).floor().mod(anim_parsed.clipFrames[clip] - 1).add(anim_parsed.clipOffsets[clip]);
        //const frame = uniforms.frame.mod( anim_parsed.frames - 1);

        const animP = Fn(() => {
            const P = vec3(0.0).toVar();
            for (let i = 0; i < num_bones_per_vt; i++) {
                const bone_index = attribute(`_bone_i_${i}`, "int");
                const bone_w = attribute(`_bone_w_${i}`, "float");
                const t = transformsBufferNode.element(bone_index.add(frame.mul(anim_parsed.bones)));
                const pos = vec4(positionLocal, 1.0).mul(t.transpose());
                P.addAssign(pos.mul(bone_w).xyz);
            }
            return P;
        })();

        material.positionNode = animP;

        return material;
    }, [map, transformsBufferNode, anim_parsed, num_bones_per_vt, uniforms]);

    return <mesh scale={2} rotation={[0, Math.PI, 0]} material={customMaterial} geometry={mesh.geometry}>

    </mesh>
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

            <Vat_Character />

        </TerrainProvider>

        {0 && <SimpleBackground />}
    </>
}

