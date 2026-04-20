import { useFrame, useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import { useCallback, useMemo, useRef } from "react";
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
    modelWorldMatrix,
    mx_noise_vec3,
    normalize,
    PI,
    positionLocal,
    rand,
    select,
    smoothstep,
    sqrt,
    texture,
    textureLoad,
    textureStore,
    transformNormalToView,
    TWO_PI,
    uint,
    uniform,
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
            res: { value: 512, min: 4, max: 1024, step: 1 },
            size: { value: 64, min: 1, max: 200 },
            wireframe: { value: false },
        }, { collapsed: false })
    });

    const { res, size, wireframe } = controls;
    const ref = useRef<THREE.Mesh>(null!);
    const player = usePlayer()
    const renderer = useWebGPURenderer()


    // Initialize Storages
    const StorageBufferA = useMemo(() => {
        const A = new ColorStorageWriteback(res);

        // Init Compute
        /*const computeInit = Fn(() => {
            const out = vec4(0).toVar();

            const uv = A.linear2uv();
            out.assign(uv);
            out.assign(mx_noise_vec3(uv.mul(10)));

            A.current.element(instanceIndex).assign(out);

        })().compute(A.res * A.res);
        renderer.computeAsync(computeInit);*/


        // 2nd Compute        
        /*
        renderer.computeAsync(Fn(() => {
            const out = vec4(0).toVar();

            const uv = A.linear2uv();
            out.assign(uv);
            out.assign(A.sample(uv.mul(0.2).add(vec2(-0.5, -0.5))))
            out.assign(A.sampleBilinear(uv.mul(0.3).add(vec2(-0.5, -0.5))))

            out.assign( A.sampleBilinearNbr(uv, A.texelSize()  ).c )            


            A.current.element(instanceIndex).assign(out);

        })().compute(A.res * A.res));
        */



        return A;
    }, [res]);

    const StorageBufferB = useMemo(() => {
        const B = new ColorStorageWriteback(res);

        const computeInit = Fn(() => {
            const out = vec4(0).toVar();

            const uv = B.uv();
            out.assign(mx_noise_vec3(uv.mul(10)));

            B.current.element(instanceIndex).assign(out);

        })().compute(B.res * B.res);
        renderer.computeAsync(computeInit);

        return B;
    }, [res]);

    const StorageBufferC = useMemo(() => (new ColorStorageWriteback(res)), [res]);
    const StorageBufferD = useMemo(() => (new ColorStorageWriteback(res)), [res]);
    const StorageTextureDepth = useMemo(() => {
        const tex = new THREE.StorageTexture(res, res)
        tex.type = THREE.FloatType;
        return tex;
    }, [res]);

    const StorageTextureNormal = useMemo(() => {
        const tex = new THREE.StorageTexture(res, res)
        tex.type = THREE.FloatType;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }, [res]);


    // Programms
    const dispatch_size = useMemo(() => res / 16, [res])

    const BufferAProgram = useMemo(() => {

        const ADVECT_DIST = float(1.0);

        const advect = Fn(([vel, uv, step]: [THREE.Node, THREE.Node, THREE.Node]) => {
            const offset_uv = uv.sub(vel.mul(ADVECT_DIST).mul(step));
            const nbr_values = StorageBufferA.sampleBilinearNbr(offset_uv, step);
            return gaussian(nbr_values);
        });

        return Fn(() => {
            const _index = uint(instanceIndex)
            const uv = StorageBufferA.uv()
            const texel = StorageBufferA.texelSize()

            // calc ma and gcurve
            const u = StorageBufferB.nbr_values(_index);
            const { ma, gcurve } = computeGcurveAndMA(u);
            const gcs = float(2.87).add(float(10000.0).mul(gcurve));

            // Advect            
            const v = StorageBufferA.current.element(_index);
            const auv_first = advect(v.xy, uv, texel);
            const auv = advect(u.c.xy.sub(auv_first.xy).mul(.5).mul(gcs), uv, texel);

            const timestep = float(0.4);
            const dv = auv.xyz.add(ma.mul(timestep)).toVar();

            // player effect
            const d = uv.xy.sub(player.tsl_PlayerWorldPosition.xz.div(size).fract())
            const m = exp( d.length().negate().div(50)) 

            const player_mask = d.length().step(0.02)

            const dv_out = dv.xyz
                .add( player_mask.oneMinus().mul(normz(d)).mul(25).mul(player.tsl_PlayerVelocity.length().min(1.0)) )
                ;


            // Output
            StorageBufferA.output.element(instanceIndex).assign(vec4(dv_out, 0));

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferB,
        player.tsl_PlayerWorldPosition,
        player.tsl_PlayerVelocity
    ]);

    const BufferBProgram = useMemo(() => {

        return Fn(() => {
            const timestep = float(0.1);

            const _index = uint(instanceIndex)
            const u = StorageBufferB.nbr_values(_index);
            const v = StorageBufferA.nbr_values(_index);
            const u_blur = gaussian(u);

            const du = vec3(u_blur.xyz.add(timestep.mul(v.c.xyz)))

            // Soft Clamp
            const ld = du.length();
            const du_softClamp = du.sub(float(0.005).mul(ld).mul(ld).mul(ld).mul(normz(du)));

            // clamping here
            StorageBufferB.output.element(instanceIndex).assign(vec4(du_softClamp.xyz, 0));

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferB
    ]);

    const BufferCProgram = useMemo(() => {
        return Fn(() => {
            const _index = uint(instanceIndex)
            const v = StorageBufferA.nbr_values(_index);
            const divergence = divergenceSmooth(v);
            StorageBufferC.current.element(instanceIndex).assign(divergence);

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferC
    ]);

    const BufferDProgram = useMemo(() => {
        return Fn(() => {
            const _index = uint(instanceIndex)
            const poisson = PoissonSolverCustom(StorageBufferC, StorageBufferD, _index);
            StorageBufferD.output.element(_index).assign(poisson);
        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferD,
        StorageBufferC
    ]);

    const CalcNandOcc = useMemo(() => {
        return Fn(() => {
            const _index = uint(instanceIndex)

            const posX = instanceIndex.mod(res);
            const posY = instanceIndex.div(res);
            const indexUV = uvec2(posX, posY);
            const localUV = vec2(indexUV).div(res);

            const N = computeNormalAA(StorageBufferD)(instanceIndex).add(1.0).mul(0.5);
            const occ = occlusion(StorageTextureDepth, localUV).div(1.5).pow(2);

            textureStore(StorageTextureNormal, indexUV, vec4(N.xyz, occ.x)).toWriteOnly();

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageTextureNormal,
        StorageTextureDepth,
        StorageBufferD
    ]);


    const frame = useRef(0)

    const block_size = useMemo(() => { return size / (res - 1) }, [res, size]);


    useFrame(() => {

        if (frame.current % 2 == 0) {
            // Update Position
            const pwp = player.playerWorldPosition;            
            ref.current.position.setX(pwp.x - pwp.x % block_size);
            ref.current.position.setZ(pwp.z - pwp.z % block_size);

            renderer.compute(BufferAProgram, [dispatch_size, dispatch_size, 1]);
            renderer.compute(StorageBufferA.writebackCompute, [dispatch_size, dispatch_size, 1]);

            renderer.compute(BufferBProgram, [dispatch_size, dispatch_size, 1]);
            renderer.compute(StorageBufferB.writebackCompute, [dispatch_size, dispatch_size, 1]);

            renderer.compute(BufferCProgram, [dispatch_size, dispatch_size, 1]);

            renderer.compute(BufferDProgram, [dispatch_size, dispatch_size, 1]);
            renderer.compute(StorageBufferD.writebackCompute, [dispatch_size, dispatch_size, 1]);

            renderer.compute(StorageBufferD.copyToTexture(StorageTextureDepth), [dispatch_size, dispatch_size, 1]);
            renderer.compute(CalcNandOcc, [dispatch_size, dispatch_size, 1]);

        }
        frame.current += 1;

    })

    // Material
    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.wireframe = wireframe;
        //mat.colorNode = float(0.0);
        //mat.emissiveNode = StorageBufferA.current.element(vertexIndex);
        //mat.emissiveNode = StorageBufferC.current.element(vertexIndex);
        //const height = StorageBufferD.current.element(vertexIndex).x.mul(0.025);
        //const normal = computeNormalAA(StorageBufferD)(vertexIndex).add(1.0).mul(0.5);
        //mat.normalNode = transformNormalToView(normal.setY(normal.y.negate()));        
        //mat.positionNode = vec3(positionLocal.x, positionLocal.y, height);

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1));
        const worldUv = worldPos.xz.div(size);

        const height = StorageBufferD.current.element(vertexIndex).x.mul(0.025);
        const normal_occ = texture(StorageTextureNormal, worldUv);

        mat.colorNode = normal_occ.w;
        mat.colorNode = float(1.0);

        const normal = normal_occ.xyz;
        mat.normalNode = transformNormalToView(normal.setY(normal.y.negate()));

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
            <planeGeometry args={[size*1, size*1, 2, 2]} />
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

        const wrappedX = _index.x.add(width).mod(width);
        const wrappedY = _index.y.add(width).mod(width);

        return wrappedY.mul(width).add(wrappedX);
    }
    index2uv(index: THREE.Node) {
        const i = ivec2(index);
        const res = float(this.res);
        return vec2(i).add(0.5).div(res);
    }
    linear2uv(linear: THREE.Node = instanceIndex) {
        return this.index2uv(this.linear2index(linear));
    }
    uv() {
        return this.linear2uv();
    }
    uv2index(uv: THREE.Node) {
        const res = float(this.res);
        return ivec2(floor(uv.mul(res)));
    }
    uv2linear(uv: THREE.Node) {
        return this.index2linear(this.uv2index(uv));
    }
    texelSize() {
        return float(1.0).div(this.res);
    }
    wrap(p: THREE.Node) {
        return ivec2(
            p.x.add(this.res).mod(this.res),
            p.y.add(this.res).mod(this.res)
        );
    }
    sampleBilinear = Fn(([uv]: [THREE.Node]) => {
        const pos = uv.mul(this.res).sub(0.5);
        const base = ivec2(floor(pos));
        const f = fract(pos);

        const i00 = this.wrap(base);
        const i10 = this.wrap(base.add(ivec2(1, 0)));
        const i01 = this.wrap(base.add(ivec2(0, 1)));
        const i11 = this.wrap(base.add(ivec2(1, 1)));

        const v00 = this.current.element(this.index2linear(i00));
        const v10 = this.current.element(this.index2linear(i10));
        const v01 = this.current.element(this.index2linear(i01));
        const v11 = this.current.element(this.index2linear(i11));

        const mixX0 = mix(v00, v10, f.x);
        const mixX1 = mix(v01, v11, f.x);

        return mix(mixX0, mixX1, f.y);
    });
    sample = Fn(([uv]: [THREE.Node]) => {
        return this.current.element(this.uv2linear(uv));
    });
    sampleBilinearNbr(
        pos: THREE.Node,
        dist = this.texelSize(),
    ) {
        const d = vec2(dist);

        const sample = (offset: THREE.Node) => {
            return this.sampleBilinear(pos.add(offset));
        };

        return {
            c: sample(vec2(0, 0)),

            n: sample(vec2(0, d.y)),
            e: sample(vec2(d.x, 0)),
            s: sample(vec2(0, d.y.negate())),
            w: sample(vec2(d.x.negate(), 0)),

            nw: sample(vec2(d.x.negate(), d.y)),
            ne: sample(vec2(d.x, d.y)),
            sw: sample(vec2(d.x.negate(), d.y.negate())),
            se: sample(vec2(d.x, d.y.negate())),
        };
    }
    copyToTexture = (tex: THREE.StorageTexture) => {
        return Fn(([tex]: [THREE.StorageTexture]) => {
            const posX = instanceIndex.mod(this.res);
            const posY = instanceIndex.div(this.res);
            const indexUV = uvec2(posX, posY);
            const val = this.current.element(instanceIndex);
            textureStore(tex, indexUV, val).toWriteOnly();
        })(tex).compute(this.res * this.res, [16, 16]);
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

export function useWebGPURenderer() {
    const { gl } = useThree();
    //@ts-ignore
    return gl as THREE.WebGPURenderer;
}

export function gaussian(values: NESW_nbrs) {
    const _G0 = 0.25;
    const _G1 = 0.125;
    const _G2 = 0.0625;

    return values.c.mul(_G0)
        .add(values.n.add(values.e).add(values.s).add(values.w).mul(_G1))
        .add(values.nw.add(values.sw).add(values.ne).add(values.se).mul(_G2))
}

export type NESW_nbrs = {
    c: THREE.Node;
    n: THREE.Node;
    e: THREE.Node;
    s: THREE.Node;
    w: THREE.Node;
    nw: THREE.Node;
    ne: THREE.Node;
    sw: THREE.Node;
    se: THREE.Node;
};

export const NEWS_UNIT = {
    c: vec3(0.0, 0.0, 0.0),
    n: vec3(0.0, 1.0, 0.0),
    ne: vec3(1.0, 1.0, 0.0),
    e: vec3(1.0, 0.0, 0.0),
    se: vec3(1.0, -1.0, 0.0),
    s: vec3(0.0, -1.0, 0.0),
    sw: vec3(-1.0, -1.0, 0.0),
    w: vec3(-1.0, 0.0, 0.0),
    nw: vec3(-1.0, 1.0, 0.0),
};

export const normz = Fn(([x]: [THREE.Node]) => {
    return select(x.length().equal(float(0.0)), vec3(0.0), x.normalize());
});

export function computeGcurveAndMA(u_raw: NESW_nbrs) {
    // Helper Functions
    const xd = float(Math.sqrt(3) / 2);
    const xi = float(1).sub(xd);

    const diagH = Fn(([x, x_v, x_h, x_d]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {
        const part1 = x.add(x_v).mul(xi);
        const part2 = x_h.add(x_d).mul(xd);
        return part1.add(part2).mul(0.5);
    });

    const diagV = Fn(([x, x_v, x_h, x_d]: [THREE.Node, THREE.Node, THREE.Node, THREE.Node]) => {
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

    // Claculations
    const u = {
        c: u_raw.c.xyz, n: u_raw.n.xyz, e: u_raw.e.xyz, s: u_raw.s.xyz, w: u_raw.w.xyz,
        nw: u_raw.nw.xyz, ne: u_raw.ne.xyz, sw: u_raw.sw.xyz, se: u_raw.se.xyz
    };

    const vx = float(0.5);
    const vy = sqrt(float(3.0)).mul(0.5);
    const hx = vy;
    const hy = vx;

    const c = u.c;

    const di_nne = nl(diagV(c, u.n, u.e, u.ne).add(vec3(vx, vy, float(0.0))).distance(c));
    const di_ene = nl(diagH(c, u.n, u.e, u.ne).add(vec3(hx, hy, float(0.0))).distance(c));
    const di_ese = nl(diagH(c, u.s, u.e, u.se).add(vec3(hx, hy.negate(), float(0.0))).distance(c));
    const di_sse = nl(diagV(c, u.s, u.e, u.se).add(vec3(vx, vy.negate(), float(0.0))).distance(c));
    const di_ssw = nl(diagV(c, u.s, u.w, u.sw).add(vec3(vx.negate(), vy.negate(), float(0.0))).distance(c));
    const di_wsw = nl(diagH(c, u.s, u.w, u.sw).add(vec3(hx.negate(), hy.negate(), float(0.0))).distance(c));
    const di_wnw = nl(diagH(c, u.n, u.w, u.nw).add(vec3(hx.negate(), hy, float(0.0))).distance(c));
    const di_nnw = nl(diagV(c, u.n, u.w, u.nw).add(vec3(vx.negate(), vy, float(0.0))).distance(c));

    const xy_n = u.n.add(NEWS_UNIT.n).sub(c);
    const xy_w = u.w.add(NEWS_UNIT.w).sub(c);
    const xy_e = u.e.add(NEWS_UNIT.e).sub(c);
    const xy_s = u.s.add(NEWS_UNIT.s).sub(c);

    const di_n = nl(u.n.add(NEWS_UNIT.n).distance(c));
    const di_w = nl(u.w.add(NEWS_UNIT.w).distance(c));
    const di_e = nl(u.e.add(NEWS_UNIT.e).distance(c));
    const di_s = nl(u.s.add(NEWS_UNIT.s).distance(c));

    const xy_nne = diagV(c, u.n, u.e, u.ne).add(vec3(vx, vy, float(0.0))).sub(c);
    const xy_ene = diagH(c, u.n, u.e, u.ne).add(vec3(hx, hy, float(0.0))).sub(c);
    const xy_ese = diagH(c, u.s, u.e, u.se).add(vec3(hx, hy.negate(), float(0.0))).sub(c);
    const xy_sse = diagV(c, u.s, u.e, u.se).add(vec3(vx, vy.negate(), float(0.0))).sub(c);
    const xy_ssw = diagV(c, u.s, u.w, u.sw).add(vec3(vx.negate(), vy.negate(), float(0.0))).sub(c);
    const xy_wsw = diagH(c, u.s, u.w, u.sw).add(vec3(hx.negate(), hy.negate(), float(0.0))).sub(c);
    const xy_wnw = diagH(c, u.n, u.w, u.nw).add(vec3(hx.negate(), hy, float(0.0))).sub(c);
    const xy_nnw = diagV(c, u.n, u.w, u.nw).add(vec3(vx.negate(), vy, float(0.0))).sub(c);

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

    return { gcurve, ma };
}

function divergenceSmooth(u: NESW_nbrs) {
    const half = float(0.5);
    const quarter = float(0.25);

    const dx =
        half.mul(u.e.x.sub(u.w.x))
            .add(
                quarter.mul(
                    u.ne.x.sub(u.nw.x)
                        .add(u.se.x.sub(u.sw.x))
                )
            );

    const dy =
        half.mul(u.n.y.sub(u.s.y))
            .add(
                quarter.mul(
                    u.ne.y.add(u.nw.y)
                        .sub(u.se.y)
                        .sub(u.sw.y)
                )
            );

    return dx.add(dy);
}

function PoissonSolverCustom(
    storage0: ColorStorage,
    storage1: ColorStorage,
    index: THREE.Node
) {

    const R = 5;
    const size = 11;

    // --- kernels inlined ---
    const a = [
        1.2882849374994847E-4, 3.9883638750009155E-4, 9.515166750018973E-4, 0.0017727328875003466, 0.0025830133546736567, 0.002936729756271805, 0.00258301335467621, 0.0017727328875031007, 9.515166750027364E-4, 3.988363875000509E-4, 1.2882849374998886E-4,
        3.988363875000656E-4, 0.00122005053750234, 0.0029276701875229076, 0.005558204850002636, 0.008287002243739282, 0.009488002668845403, 0.008287002243717386, 0.005558204850002533, 0.002927670187515983, 0.0012200505375028058, 3.988363875001047E-4,
        9.515166750033415E-4, 0.0029276701875211478, 0.007226947743770152, 0.014378101312275642, 0.02243013709214819, 0.026345595431380788, 0.02243013709216395, 0.014378101312311218, 0.007226947743759695, 0.0029276701875111384, 9.515166750008558E-4,
        0.0017727328875040689, 0.005558204850002899, 0.014378101312235814, 0.030803252137257802, 0.052905271651623786, 0.06562027788638072, 0.052905271651324026, 0.03080325213733769, 0.014378101312364885, 0.005558204849979354, 0.0017727328874979902,
        0.0025830133546704635, 0.008287002243679713, 0.02243013709210261, 0.052905271651950365, 0.10825670746239457, 0.15882720544362505, 0.10825670746187367, 0.05290527165080182, 0.02243013709242713, 0.008287002243769156, 0.0025830133546869602,
        0.00293672975627608, 0.009488002668872716, 0.026345595431503218, 0.06562027788603421, 0.15882720544151602, 0.44102631192030745, 0.15882720544590473, 0.06562027788637015, 0.026345595431065568, 0.009488002668778417, 0.0029367297562566848,
        0.0025830133546700966, 0.008287002243704267, 0.022430137092024266, 0.05290527165218751, 0.10825670746234733, 0.1588272054402839, 0.1082567074615041, 0.052905271651381314, 0.022430137092484193, 0.00828700224375486, 0.002583013354686416,
        0.0017727328875014527, 0.005558204850013428, 0.01437810131221156, 0.03080325213737849, 0.05290527165234342, 0.06562027788535467, 0.05290527165227899, 0.03080325213731504, 0.01437810131229074, 0.005558204849973625, 0.0017727328874977803,
        9.515166750022218E-4, 0.002927670187526038, 0.0072269477437592895, 0.014378101312185454, 0.02243013709218059, 0.02634559543148722, 0.0224301370922164, 0.014378101312200022, 0.007226947743773282, 0.0029276701875125123, 9.515166750016471E-4,
        3.988363875000695E-4, 0.0012200505375021846, 0.002927670187525898, 0.005558204849999022, 0.008287002243689638, 0.009488002668901728, 0.008287002243695645, 0.0055582048500028335, 0.002927670187519828, 0.0012200505375025872, 3.988363874999818E-4,
        1.2882849374993535E-4, 3.9883638750004726E-4, 9.515166750034058E-4, 0.0017727328875029819, 0.0025830133546718525, 0.002936729756279661, 0.002583013354672541, 0.0017727328875033709, 9.515166750023861E-4, 3.988363874999023E-4, 1.2882849374998856E-4
    ];

    const b = [
        8673174.0, 1.5982146E7, 2.5312806E7, 3.4957296E7, 4.2280236E7, 4.5059652E7, 4.2280236E7, 3.4957296E7, 2.5312806E7, 1.5982146E7, 8673174.0,
        1.5982146E7, 2.9347785E7, 4.6341531E7, 6.3895356E7, 7.7184405E7, 8.2245411E7, 7.7184405E7, 6.3895356E7, 4.6341531E7, 2.9347785E7, 1.5982146E7,
        2.5312806E7, 4.6341531E7, 7.2970173E7, 1.00453608E8, 1.21193181E8, 1.29118131E8, 1.21193181E8, 1.00453608E8, 7.2970173E7, 4.6341531E7, 2.5312806E7,
        3.4957296E7, 6.3895356E7, 1.00453608E8, 1.38192768E8, 1.66613346E8, 1.77507756E8, 1.66613346E8, 1.38192768E8, 1.00453608E8, 6.3895356E7, 3.4957296E7,
        4.2280236E7, 7.7184405E7, 1.21193181E8, 1.66613346E8, 2.00759625E8, 2.13875721E8, 2.00759625E8, 1.66613346E8, 1.21193181E8, 7.7184405E7, 4.2280236E7,
        4.5059652E7, 8.2245411E7, 1.29118131E8, 1.77507756E8, 2.13875721E8, 2.27856753E8, 2.13875721E8, 1.77507756E8, 1.29118131E8, 8.2245411E7, 4.5059652E7,
        4.2280236E7, 7.7184405E7, 1.21193181E8, 1.66613346E8, 2.00759625E8, 2.13875721E8, 2.00759625E8, 1.66613346E8, 1.21193181E8, 7.7184405E7, 4.2280236E7,
        3.4957296E7, 6.3895356E7, 1.00453608E8, 1.38192768E8, 1.66613346E8, 1.77507756E8, 1.66613346E8, 1.38192768E8, 1.00453608E8, 6.3895356E7, 3.4957296E7,
        2.5312806E7, 4.6341531E7, 7.2970173E7, 1.00453608E8, 1.21193181E8, 1.29118131E8, 1.21193181E8, 1.00453608E8, 7.2970173E7, 4.6341531E7, 2.5312806E7,
        1.5982146E7, 2.9347785E7, 4.6341531E7, 6.3895356E7, 7.7184405E7, 8.2245411E7, 7.7184405E7, 6.3895356E7, 4.6341531E7, 2.9347785E7, 1.5982146E7,
        8673174.0, 1.5982146E7, 2.5312806E7, 3.4957296E7, 4.2280236E7, 4.5059652E7, 4.2280236E7, 3.4957296E7, 2.5312806E7, 1.5982146E7, 8673174.0
    ];

    const ac = vec4(0).toVar();
    const bc = vec4(0).toVar();
    const bcw = float(0).toVar();

    const base = storage0.linear2index(index);

    for (let j = -R; j <= R; j++) {
        for (let i = -R; i <= R; i++) {
            const kernel_index = (j + R) * size + (i + R);

            const offset = ivec2(i, j);
            const coord = storage0.wrap(base.add(offset));

            const idx = storage0.index2linear(coord);

            const tx0 = storage0.current.element(idx);
            const tx1 = storage1.current.element(idx);

            const aVal = float(a[kernel_index]);
            const bVal = float(b[kernel_index]);

            ac.addAssign(aVal.negate().mul(tx0));
            bc.addAssign(bVal.mul(tx1));
            bcw.addAssign(bVal);
        }
    }
    return ac.add(bc.div(bcw));
}

const computeNormalAA = (storage: ColorStorage, bump = 1.0) => Fn(([index]: [THREE.Node]) => {
    const n = storage.nbr_values(index);
    // precompute gradients like shader
    // https://www.shadertoy.com/view/Mstczn
    const dxn = [
        n.ne.x.sub(n.nw.x),
        n.e.x.sub(n.w.x),
        n.se.x.sub(n.sw.x)
    ];

    const dyn = [
        n.nw.x.sub(n.sw.x).x,
        n.n.x.sub(n.s.x).x,
        n.ne.x.sub(n.se.x).x
    ];

    const weights = [0.5, 1.0, 0.5];

    const acc = vec3(0).toVar();
    const sum = float(0).toVar();

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {

            const w = float(weights[i] * weights[j]);

            const dx = dxn[i];
            const dy = dyn[j];

            const nrm = normalize(vec3(
                dx.mul(bump),
                dy.mul(bump),
                float(-1.0)
            ));

            acc.addAssign(nrm.mul(w));
            sum.addAssign(w);
        }
    }

    return normalize(acc.div(sum));
});

const occlusion = Fn(([tex, uv]: [THREE.StorageTexture, THREE.Node]) => {
    const d = texture(tex, uv, 0).x;
    const occ = float(0.0).toVar();

    // JS loop → gets unrolled into shader
    for (let m = 1; m <= 10; m++) {
        const mip = float(m);
        const dm = texture(tex, uv, mip).x;
        const weight = float(1.0).div(mip.mul(mip));
        const contrib = smoothstep(
            float(-8.0),
            float(2.0),
            d.sub(dm)
        );
        occ.addAssign(contrib.mul(weight));
    }
    return occ;
});
