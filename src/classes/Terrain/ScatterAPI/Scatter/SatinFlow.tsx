import { useFrame, useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import { useMemo, useRef } from "react";
import { Fn } from "three/src/nodes/TSL.js";
import {
    acos,
    clamp,
    distance,
    exp,
    float,
    floor,
    fract,
    globalId,
    instancedArray,
    instanceIndex,
    int,
    ivec2,
    mix,
    PI,
    rand,
    select,
    sqrt,
    texture,
    textureLoad,
    textureStore,
    TWO_PI,
    uint,
    uv,
    uvec2,
    vec2,
    vec3,
    vec4,
    vertexIndex
} from "three/tsl";
import * as THREE from 'three/webgpu'
import { usePlayer } from "../../../Player/PlayerContext";





export function DrawOnTexture() {

    const ref = useRef<THREE.Mesh>(null!);

    const controls = useControls("Terrain", {
        Satin: folder({
            res: { value: 256, min: 4, max: 1024, step: 1 },
            size: { value: 32, min: 1, max: 200 },
            wireframe: { value: false },
        }, { collapsed: false })
    });

    const { res, size, wireframe } = controls;

    const storageTexture = useMemo(() => {
        const tex = new THREE.StorageTexture(res, res);
        const tex_prev = new THREE.StorageTexture(res, res);
        //tex.minFilter = THREE.NearestFilter;
        //tex.magFilter = THREE.NearestFilter;

        const writeBack = Fn(([tex, texPrev]: [THREE.StorageTexture, THREE.StorageTexture]) => {

            const posX = instanceIndex.mod(res);
            const posY = instanceIndex.div(res);
            const indexUV = uvec2(posX, posY);
            const prev_val = textureLoad(tex, indexUV);
            textureStore(texPrev, indexUV, prev_val).toWriteOnly();

        })(tex, tex_prev).compute(res * res);


        return { tex, tex_prev, writeBack };
    }, [res]);

    const uvToWorldXZ = Fn(([uv, size]: [THREE.Node, number]) => {
        const centered = uv.sub(0.5).mul(size);
        return vec3(centered.x, 0.0, centered.y.negate());
    });

    const player = usePlayer()

    const computeTexture = useMemo(() => {

        return Fn(([tex, texPrev]: [THREE.StorageTexture, THREE.StorageTexture]) => {

            const posX = instanceIndex.mod(res);
            const posY = instanceIndex.div(res);
            const indexUV = uvec2(posX, posY);
            const localUV = vec2(indexUV).div(res);

            const prev_val = textureLoad(texPrev, indexUV).sub(0.005);

            const worldPos = uvToWorldXZ(localUV, size);
            const player_dist = player.tsl_PlayerWorldPosition.mul(vec3(1, 0, 1)).sub(worldPos);
            const out = player_dist.length().step(2).oneMinus().max(prev_val);

            textureStore(tex, indexUV, out).toWriteOnly();

        });
    }, [res, size, player.tsl_PlayerWorldPosition]);

    const computeNode = useMemo(() => {
        return computeTexture(storageTexture.tex, storageTexture.tex_prev).compute(res * res);
    }, [computeTexture, storageTexture, res]);

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    useFrame(() => {
        renderer.compute(computeNode);
        renderer.compute(storageTexture.writeBack);
    });


    // Material
    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.colorNode = texture(storageTexture.tex, uv());
        mat.wireframe = wireframe;

        return mat;
    }, [res, size, wireframe])

    // res should be res-1 to match the thing
    return <group ref={ref} >
        <mesh
            rotation={[-Math.PI * 0.5, 0, 0]}
            position={[0, 0, 0]}
            material={material}
        //renderOrder={998}
        >
            <planeGeometry args={[size, size, 1, 1]} />
        </mesh>

    </group>
}

export function DrawOnStorageWithBlur() {

    const controls = useControls("Terrain", {
        Satin: folder({
            res: { value: 256, min: 4, max: 1024, step: 1 },
            size: { value: 32, min: 1, max: 200 },
            wireframe: { value: false },
        }, { collapsed: false })
    });


    const { res, size, wireframe } = controls;
    const ref = useRef<THREE.Mesh>(null!);
    const player = usePlayer()
    const renderer = useWebGPURenderer()

    // Initialize Storages
    const colorStorage = useMemo(() => {
        return new ColorStorageWriteback(res);
    }, [res]);


    const dispatch_size = useMemo(() => res / 16, [res])

    const computeProgramm = useMemo(() => {
        return Fn(() => {
            const _index = uint(instanceIndex)

            //const height = colorStorage.current.element(_index);
            const blurred = gaussian(colorStorage.nbr_values(_index));

            // Clalc Worl pos
            const uv = vec2(globalId.xy).div(res);
            const worldPos = vec3(uv.x.sub(0.5).mul(size), 0.0, uv.y.sub(0.5).mul(size));

            const playerMask = worldPos.sub(player.tsl_PlayerWorldPosition).length().step(0.5).oneMinus();
            const out = blurred.toVar();
            out.mulAssign(0.995);
            out.maxAssign(playerMask);

            colorStorage.output.element(instanceIndex).assign(out);

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        colorStorage
    ]);

    useFrame(() => {
        renderer.compute(computeProgramm, [dispatch_size, dispatch_size, 1]);
        renderer.compute(colorStorage.writebackCompute, [dispatch_size, dispatch_size, 1]);
    })

    // Material
    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.wireframe = wireframe;
        mat.colorNode = colorStorage.current.element(vertexIndex);

        return mat;
    }, [res, size, wireframe])

    // res should be res-1 to match the thing
    return <group ref={ref} >
        <mesh
            rotation={[-Math.PI * 0.5, 0, 0]}
            position={[0, 0, 0]}
            material={material}
        //renderOrder={998}
        >
            <planeGeometry args={[size, size, res - 1, res - 1]} />
        </mesh>

    </group>
}




export function SatinFlow() {

    const controls = useControls("Terrain", {
        Satin: folder({
            res: { value: 256, min: 4, max: 1024, step: 1 },
            size: { value: 32, min: 1, max: 200 },
            wireframe: { value: false },
        }, { collapsed: false })
    });


    const { res, size, wireframe } = controls;
    const ref = useRef<THREE.Mesh>(null!);
    const player = usePlayer()
    const renderer = useWebGPURenderer()

    // Initialize Storages
    const StorageBufferA = useMemo(() => {
        const A =  new ColorStorageWriteback(res);
        renderer.computeAsync(A.computeInit);

        return A;
    }, [res]);

    const StorageBufferB = useMemo(() => {
        return new ColorStorageWriteback(res);
    }, [res]);


    const dispatch_size = useMemo(() => res / 16, [res])

    const computeProgramm = useMemo(() => {
        return Fn(() => {
            const _index = uint(instanceIndex)

            //const height = colorStorage.current.element(_index);
            const blurred = gaussian(StorageBufferA.nbr_values(_index));

            // Clalc Worl pos
            const uv = vec2(globalId.xy).div(res);
            const worldPos = vec3(uv.x.sub(0.5).mul(size), 0.0, uv.y.sub(0.5).mul(size));

            const playerMask = worldPos.sub(player.tsl_PlayerWorldPosition).length().step(0.5).oneMinus();
            const out = blurred.toVar();
            out.mulAssign(0.995);
            out.maxAssign(playerMask);

            StorageBufferA.output.element(instanceIndex).assign(out);

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferA
    ]);

    const BufferAProgram = useMemo(() => {
        /**
         vec3 diagH(vec3 x, vec3 x_v, vec3 x_h, vec3 x_d) {
            const float xd = sqrt(3.0) / 2.0;
            const float xi = 1.0 - xd;
            return 0.5 * ((x + x_v) * xi + (x_h + x_d) * xd);
        }

        vec3 diagV(vec3 x, vec3 x_v, vec3 x_h, vec3 x_d) {
            const float xd = sqrt(3.0) / 2.0;
            const float xi = 1.0 - xd;
            return 0.5 * ((x + x_h) * xi + (x_v + x_d) * xd);
        }                
         */

        const xd = float(Math.sqrt(3) / 2);
        const xi = float(1).sub(xd);

        const diagH = Fn(([x, x_v, x_h, x_d]: THREE.Node[]) => {
            const part1 = x.add(x_v).mul(xi);
            const part2 = x_h.add(x_d).mul(xd);
            return part1.add(part2).mul(0.5);
        });

        const diagV = Fn(([x, x_v, x_h, x_d]: THREE.Node[]) => {
            const part1 = x.add(x_h).mul(xi);
            const part2 = x_v.add(x_d).mul(xd);
            return part1.add(part2).mul(0.5);
        });

        const W0 = float(20.0);
        const W1 = float(0.5);

        const nl = Fn(([x]: [THREE.Node]) => {
            return float(1.0).div(float(1.0).add(exp(W0.mul(W1.mul(x).sub(0.5))))
            );
        });

        const ADVECT_DIST = float(1.0);

        const advect = Fn(([ab, index, step]: [THREE.Node, THREE.Node, THREE.Node]) => {
            // 1. backtrace position (UV-style logic removed → index-space approximation)
            const offset = ab.mul(ADVECT_DIST).mul(step);
            const aIndex = StorageBufferA.linear2index(index).sub(offset);
            // 2. sample neighborhood from storage buffer
            const u = StorageBufferA.nbr_values(StorageBufferA.index2linear(aIndex));
            // 3. gaussian reconstruction
            return gaussian(u);
        });


        // directions
        const n = vec3(0.0, 1.0, 0.0);
        const ne = vec3(1.0, 1.0, 0.0);
        const e = vec3(1.0, 0.0, 0.0);
        const se = vec3(1.0, -1.0, 0.0);
        const s = vec3(0.0, -1.0, 0.0);
        const sw = vec3(-1.0, -1.0, 0.0);
        const w = vec3(-1.0, 0.0, 0.0);
        const nw = vec3(-1.0, 1.0, 0.0);

        return Fn(() => {
            const _index = uint(instanceIndex)
            const u = StorageBufferA.nbr_values(_index);
            const v = StorageBufferB.nbr_values(_index);

            const vx = float(0.5);
            const vy = sqrt(float(3.0)).mul(0.5);
            const hx = vy;
            const hy = vx;

            const di_nne = nl(diagV(u.c, u.n, u.e, u.ne).add(vec3(vx, vy, float(0.0))).distance(u.c));
            const di_ene = nl(diagH(u.c, u.n, u.e, u.ne).add(vec3(hx, hy, float(0.0))).distance(u.c));
            const di_ese = nl(diagH(u.c, u.s, u.e, u.se).add(vec3(hx, hy.negate(), float(0.0))).distance(u.c));
            const di_sse = nl(diagV(u.c, u.s, u.e, u.se).add(vec3(vx, vy.negate(), float(0.0))).distance(u.c));
            const di_ssw = nl(diagV(u.c, u.s, u.w, u.sw).add(vec3(vx.negate(), vy.negate(), float(0.0))).distance(u.c));
            const di_wsw = nl(diagH(u.c, u.s, u.w, u.sw).add(vec3(hx.negate(), hy.negate(), float(0.0))).distance(u.c));
            const di_wnw = nl(diagH(u.c, u.n, u.w, u.nw).add(vec3(hx.negate(), vy, float(0.0))).distance(u.c));
            const di_nnw = nl(diagV(u.c, u.n, u.w, u.nw).add(vec3(vx.negate(), vy, float(0.0))).distance(u.c));

            const xy_n = u.n.add(n).sub(u.c);
            const xy_w = u.w.add(w).sub(u.c);
            const xy_e = u.e.add(e).sub(u.c);
            const xy_s = u.s.add(s).sub(u.c);

            const di_n = nl(u.n.add(n).distance(u.c));
            const di_w = nl(u.w.add(w).distance(u.c));
            const di_e = nl(u.e.add(e).distance(u.c));
            const di_s = nl(u.s.add(s).distance(u.c));

            const xy_nne = diagV(u.c, u.n, u.e, u.ne).add(vec3(vx, vy, float(0.0))).sub(u.c);
            const xy_ene = diagH(u.c, u.n, u.e, u.ne).add(vec3(hx, hy, float(0.0))).sub(u.c);
            const xy_ese = diagH(u.c, u.s, u.e, u.se).add(vec3(hx, hy.negate(), float(0.0))).sub(u.c);
            const xy_sse = diagV(u.c, u.s, u.e, u.se).add(vec3(vx, vy.negate(), float(0.0))).sub(u.c);
            const xy_ssw = diagV(u.c, u.s, u.w, u.sw).add(vec3(vx.negate(), vy.negate(), float(0.0))).sub(u.c);
            const xy_wsw = diagH(u.c, u.s, u.w, u.sw).add(vec3(hx.negate(), hy.negate(), float(0.0))).sub(u.c);
            const xy_wnw = diagH(u.c, u.n, u.w, u.nw).add(vec3(hx.negate(), vy, float(0.0))).sub(u.c);
            const xy_nnw = diagV(u.c, u.n, u.w, u.nw).add(vec3(vx.negate(), vy, float(0.0))).sub(u.c);

            const t0 = clamp(acos(xy_n.normalize().dot(xy_nne.normalize())), float(0.0), PI);
            const t1 = clamp(acos(xy_nne.normalize().dot(xy_ene.normalize())), float(0.0), PI);
            const t2 = clamp(acos(xy_ene.normalize().dot(xy_e.normalize())), float(0.0), PI);
            const t3 = clamp(acos(xy_e.normalize().dot(xy_ese.normalize())), float(0.0), PI);
            const t4 = clamp(acos(xy_ese.normalize().dot(xy_sse.normalize())), float(0.0), PI);
            const t5 = clamp(acos(xy_sse.normalize().dot(xy_s.normalize())), float(0.0), PI);
            const t6 = clamp(acos(xy_s.normalize().dot(xy_ssw.normalize())), float(0.0), PI);
            const t7 = clamp(acos(xy_ssw.normalize().dot(xy_wsw.normalize())), float(0.0), PI);
            const t8 = clamp(acos(xy_wsw.normalize().dot(xy_w.normalize())), float(0.0), PI);
            const t9 = clamp(acos(xy_w.normalize().dot(xy_wnw.normalize())), float(0.0), PI);
            const t10 = clamp(acos(xy_wnw.normalize().dot(xy_nnw.normalize())), float(0.0), PI);
            const t11 = clamp(acos(xy_nnw.normalize().dot(xy_n.normalize())), float(0.0), PI);

            const gcurve = TWO_PI.sub(
                t0.add(t1)
                    .add(t2)
                    .add(t3)
                    .add(t4)
                    .add(t5)
                    .add(t6)
                    .add(t7)
                    .add(t8)
                    .add(t9)
                    .add(t10)
                    .add(t11)
            );

            const ma =
                di_nne.mul(xy_nne)
                    .add(di_ene.mul(xy_ene))
                    .add(di_ese.mul(xy_ese))
                    .add(di_sse.mul(xy_sse))
                    .add(di_ssw.mul(xy_ssw))
                    .add(di_wsw.mul(xy_wsw))
                    .add(di_wnw.mul(xy_wnw))
                    .add(di_nnw.mul(xy_nnw))
                    .add(di_n.mul(xy_n))
                    .add(di_w.mul(xy_w))
                    .add(di_e.mul(xy_e))
                    .add(di_s.mul(xy_s));

            const v_blur = gaussian(v);
            const gcs = float(2.87).add(float(10000.0).mul(gcurve));

            // Advect
            const texel = float(1.0);
            const auv_first = advect(v.c.xy, _index, texel);
            const auv = advect(float(48.0).mul(gcs).mul(u.c.sub(auv_first).xy), _index, texel);

            const timestep = float(0.5);
            const dv = auv.add(ma.mul(timestep));

            // clamping here
            StorageBufferA.output.element(instanceIndex).assign(vec4(dv.xyz, gcurve));

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferB
    ]);



    const BufferBProgram = useMemo(() => {

        const normz = Fn(([x]: [THREE.Node]) => {
            const len = x.length();
            return select(
                len.equal(float(0.0)),
                vec3(0.0),
                x.normalize()
            );
        });


        return Fn(() => {
            const _index = uint(instanceIndex)
            const u = StorageBufferA.nbr_values(_index);
            const v = StorageBufferB.nbr_values(_index);

            const u_blur = gaussian(u);
            const v_blur = gaussian(v);


            const gc = v_blur.w;
            const timestep = float(0.5);
            const du = u_blur.add(timestep.mul(v.c.xyz))

            const ld = du.length();

            const du_softClamp = du.sub(
                float(0.005)
                    .mul(ld)
                    .mul(ld)
                    .mul(ld)
                    .mul(normz(du))
            );

            // clamping here
            StorageBufferB.output.element(instanceIndex).assign(vec4(du_softClamp.xyz, gc));

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferB
    ]);

    useFrame(() => {

        renderer.compute(BufferAProgram, [dispatch_size, dispatch_size, 1]);
        renderer.compute(StorageBufferA.writebackCompute, [dispatch_size, dispatch_size, 1]);

        renderer.compute(BufferBProgram, [dispatch_size, dispatch_size, 1]);
        renderer.compute(StorageBufferB.writebackCompute, [dispatch_size, dispatch_size, 1]);

    })

    // Material
    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.wireframe = wireframe;
        mat.colorNode = StorageBufferA.current.element(vertexIndex);

        return mat;
    }, [res, size, wireframe])

    // res should be res-1 to match the thing
    return <group ref={ref} >
        <mesh
            rotation={[-Math.PI * 0.5, 0, 0]}
            position={[0, 0, 0]}
            material={material}
        //renderOrder={998}
        >
            <planeGeometry args={[size, size, res - 1, res - 1]} />
        </mesh>

    </group>
}



export class ColorStorage {
    current: THREE.StorageBufferNode;
    res: number;

    constructor(res: number) {
        this.res = res;
        this.current = instancedArray(res * res, 'vec4');
    }

    get computeInit() {
        return Fn(() => { // the compute shader
            this.current.element(instanceIndex).assign(rand(instanceIndex));
        })().compute(this.res * this.res);
    }

    linear2index(linear: THREE.Node) {
        // Fix: Force both linear and width to be signed integers (i32)
        const _linear = int(linear);
        const width = int(this.res);

        const x = _linear.mod(width);
        const y = _linear.div(width);
        return ivec2(x, y);
    }

    index2linear(index: THREE.Node) {
        // Fix: Force index to be an ivec2 (i32) in case a float vector is passed in from 'advect'
        const _index = ivec2(index);
        const width = int(this.res);
        const maxX = width.sub(1);

        const new_x = clamp(_index.x, 0, maxX);
        const new_y = clamp(_index.y, 0, maxX);
        return new_y.mul(width).add(new_x);
    }

    nbr_values(index: THREE.Node, storage: THREE.StorageBufferNode = this.current) {
        const base = this.linear2index(index);

        return {
            c: storage.element(this.index2linear(base.add(ivec2(0, 0)))),

            n: storage.element(this.index2linear(base.add(ivec2(0, 1)))),
            e: storage.element(this.index2linear(base.add(ivec2(1, 0)))),
            s: storage.element(this.index2linear(base.add(ivec2(0, -1)))),
            w: storage.element(this.index2linear(base.add(ivec2(-1, 0)))),

            nw: storage.element(this.index2linear(base.add(ivec2(-1, 1)))),
            sw: storage.element(this.index2linear(base.add(ivec2(-1, -1)))),
            ne: storage.element(this.index2linear(base.add(ivec2(1, 1)))),
            se: storage.element(this.index2linear(base.add(ivec2(1, -1)))),
        };
    }
}

export class ColorStorageWriteback extends ColorStorage {
    output: THREE.StorageBufferNode;

    constructor(res: number) {
        super(res);
        this.output = instancedArray(res * res, 'vec4').setName('colorStorage_output');
    }

    get writebackCompute() {
        return Fn(([output, current]: [THREE.StorageBufferNode, THREE.StorageBufferNode]) => {
            current.element(instanceIndex).assign(output.element(instanceIndex));
        })(this.output, this.current).compute(this.res * this.res, [16, 16]);
    }

}


export function gaussian(values: any) {
    const _G0 = 0.25;
    const _G1 = 0.125;
    const _G2 = 0.0625;

    return values.c.mul(_G0)
        .add(values.n.add(values.e).add(values.s).add(values.w).mul(_G1))
        .add(values.nw.add(values.sw).add(values.ne).add(values.se).mul(_G2))
}


export function useWebGPURenderer() {
    const { gl } = useThree();
    //@ts-ignore
    return gl as THREE.WebGPURenderer;
}
