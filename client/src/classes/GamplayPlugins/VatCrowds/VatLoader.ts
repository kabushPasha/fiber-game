import { useGLTF, useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { useCallback,  useMemo } from "react";
import { Fn } from "three/src/nodes/TSL.js";
import {  attribute, instanceIndex, int, normalLocal, positionLocal, storage, texture, time, uniformArray, uv, vec2, vec3, vec4 } from "three/tsl";
import * as THREE from "three/webgpu"


// Loads Vat char
// url.glb
// url.glb.png
// url.bin
export function useVatCharLoader(url: string) {
    // Load GLTF
    const gltf_model = useGLTF(url)
    // Get first meshas
    const mesh = useMemo(() => { return gltf_model.meshes[Object.keys(gltf_model.meshes)[0]] }, [gltf_model])
    const num_bones_per_vt = useMemo(() => mesh.geometry.attributes._bone_i.itemSize, [mesh]);
    const geometry = useMemo(() => mesh.geometry, [mesh]);

    // Map
    const map = useTexture(url + ".png")
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = 'srgb'

    const vatLoader = useVatLoader(url.replace(".glb", ".bin"), num_bones_per_vt);

    const tsl_tex_color = useMemo(() => {
        const flippedUV = vec2(uv().x, uv().y.oneMinus())
        return texture(map, flippedUV);
    }, [map])

    type SimpleMaterialsOptions = {
        instanceMatrix?: THREE.Node;
        clip?: THREE.Node;
    };

    const simple_materials = useCallback(
        ({ instanceMatrix, clip = int(1) }: SimpleMaterialsOptions = {}) => {
            {
                const material = new THREE.MeshBasicNodeMaterial();
                material.colorNode = tsl_tex_color;

                const fps = 12;
                const frame = time.mul(fps).add( instanceIndex );

                const P = vatLoader.tsl_boneDeformPositionClip(clip, positionLocal, frame);
                material.positionNode = instanceMatrix ? instanceMatrix.mul(P) : P;

                const outline_material = new THREE.MeshBasicNodeMaterial();
                outline_material.side = THREE.BackSide;
                outline_material.colorNode = vec3(0.0);

                const P_outline = vatChar.tsl_boneDeformPositionClip(clip, positionLocal.add(normalLocal.mul(0.02)), frame);
                outline_material.positionNode = instanceMatrix ? instanceMatrix.mul(P_outline) : P_outline;


                return [material, outline_material];
            }
        }, [tsl_tex_color, vatLoader])




    const vatChar = useMemo(() => {
        return {
            gltf_model,
            mesh,
            geometry,
            map,
            vatLoader,
            tsl_tex_color,
            tsl_frame2clipFrame: vatLoader.tsl_frame2clipFrame,
            tsl_boneDeformPositionClip: vatLoader.tsl_boneDeformPositionClip,
            simple_materials,
        }
    }, [gltf_model, mesh, map, vatLoader, tsl_tex_color, simple_materials])

    return vatChar;
}



export function useVatLoader(url: string, num_bones_per_vt: number) {
    // Load Animation File
    const anim_raw = useLoader(
        THREE.FileLoader,
        url,
        async (loader) => { loader.setResponseType("arraybuffer") }
    ) as ArrayBuffer;

    // parse Aanim data
    const anim_parsed = useMemo(() => parseAnimBin(anim_raw), [anim_raw]);

    // Store Into Buffer
    const boneTransfomrsBufferAttribute = useMemo(() => {
        return new THREE.StorageInstancedBufferAttribute(anim_parsed.data, 16);
    }, [anim_parsed])

    const boneTransformsBufferNode = useMemo(() =>
        storage(boneTransfomrsBufferAttribute)
        , [boneTransfomrsBufferAttribute]);

    const tsl_clipdata = useMemo(() => {
        const clip_frames = uniformArray(anim_parsed.clipFrames, "uint");
        const clip_offsets = uniformArray(anim_parsed.clipOffsets, "uint");
        return { clip_frames, clip_offsets };
    }, [anim_parsed])

    const tsl_boneDeformPosition = useMemo(() => {
        return Fn(([in_pos, frame]: [THREE.Node, THREE.Node]) => {
            const P = vec3(0.0).toVar();
            for (let i = 0; i < num_bones_per_vt; i++) {
                const bone_index = attribute(`_bone_i`).element(int(i));
                const bone_w = attribute(`_bone_w`).element(int(i));
                const t = boneTransformsBufferNode.element(bone_index.add(frame.mul(anim_parsed.bones)));
                const pos = vec4(in_pos, 1.0).mul(t.transpose());
                P.addAssign(pos.mul(bone_w).xyz);
            }
            return P;
        });
    }, [num_bones_per_vt, boneTransformsBufferNode, anim_parsed.bones])

    const tsl_frame2clipFrame = useMemo(() => {
        return (clip: THREE.Node, frame: THREE.Node) => {
            return frame
                .floor()
                .mod(tsl_clipdata.clip_frames.element(clip).sub(1))
                .add(tsl_clipdata.clip_offsets.element(clip))
        }
    }, [anim_parsed])

    const tsl_boneDeformPositionClip = useMemo(() => {
        return (clip: THREE.Node, pos: THREE.Node, frame: THREE.Node) => {
            const clip_frame = tsl_frame2clipFrame(clip, frame)
            return tsl_boneDeformPosition(pos, clip_frame);
        }
    }, [anim_parsed])


    const vatLoader = useMemo(() => {
        return {
            anim_raw,
            tsl_boneDeformPosition,
            tsl_boneDeformPositionClip,
            tsl_frame2clipFrame,
            boneTransformsBufferNode,
            boneTransfomrsBufferAttribute,
            anim_parsed
        };
    }, [
        tsl_boneDeformPosition,
        tsl_boneDeformPositionClip,
        tsl_frame2clipFrame,
        boneTransformsBufferNode,
        boneTransfomrsBufferAttribute,
        anim_parsed,
        anim_raw
    ])

    return vatLoader;
}





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

export function float16ToFloat32(bits: number): number {
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