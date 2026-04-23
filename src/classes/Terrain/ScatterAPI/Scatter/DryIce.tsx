import { usePlayer } from "../../../Player/PlayerContext";
import { SimpleBackground } from "../../../shaders/Aurora";
import { Player } from "../../../Player/Player";
import { GroundClampSimple, Jump, MoveByVel } from "../../../Player/PlayerPhysics";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import { ColorStorageWriteback, useWebGPURenderer } from "./SatinFlow";
import * as THREE from 'three/webgpu'
import { useFrame } from "@react-three/fiber";
import {
    Break,
    cameraPosition,
    cameraProjectionMatrixInverse,
    cameraWorldMatrix,
    clamp,
    float,
    getViewPosition,
    If,
    instanceIndex,
    ivec2,
    Loop,
    mix,
    modelWorldMatrix,
    positionLocal,
    screenUV,
    uint,
    uniform,
    vec2,
    vec3,
    vec4,
    vertexIndex,
    viewportDepthTexture,
    viewportSharedTexture
} from "three/tsl";
import { Fn } from "three/src/nodes/TSL.js";
import { Pixelated } from "../../../../components/Pixelated";

export function DryIceLevel() {

    return <>
        <Pixelated resolution={256} enabled={true} />

        <group name="Lights">
            <ambientLight intensity={0.0} />
            <directionalLight position={[10, 5, 0]} intensity={0.0} />
        </group>

        {0 && <SimpleBackground />}

        <Player >
            <MoveByVel />
            <Jump />
            <GroundClampSimple />
        </Player>

        <DryIce />
    </>;
}




export function DryIce() {

    const controls = useControls("Terrain", {
        DryIce: folder({
            res: { value: 256, min: 4, max: 1024, step: 1 },
            size: { value: 64, min: 1, max: 200 },
            wireframe: { value: false },

            Light: folder({
                ligth_intensity: { value: 150.0, min: 0.0, max: 200 },
                follow_player: { value: true }
            })
        }, { collapsed: false })
    });

    const uniforms = useMemo(() => ({
        ligth_intensity: uniform(controls.ligth_intensity).setName('light_intensity'),
        light_position:uniform(new THREE.Vector3(0,0,0)).setName('light_position')
    }), []);

    useEffect(() => {
        uniforms.ligth_intensity.value = controls.ligth_intensity;

    }, [
        uniforms,
        controls.ligth_intensity
    ]);


    const { res, size, wireframe } = controls;
    const ref = useRef<THREE.Mesh>(null!);
    const lights_group = useRef<THREE.Group>(null!);
    const player = usePlayer()
    const renderer = useWebGPURenderer()
    const dispatch_size = useMemo(() => res / 16, [res])
    //const block_size = useMemo(() => { return size / (res - 1) }, [res, size]);

    //Reste Position
    useEffect(() => {
        if (!controls.follow_player) 
            {
                lights_group.current.position.copy(new THREE.Vector3(0, 0, 0));
                uniforms.light_position.value.set( 0,5,0)
            }
    }, [controls.follow_player])

    // Buffser
    const StorageBufferA = useMemo(() => (new ColorStorageWriteback(res)), [res]);
    const StorageBufferB = useMemo(() => (new ColorStorageWriteback(res)), [res]);
    const StorageBufferC = useMemo(() => (new ColorStorageWriteback(res)), [res]);
    const StorageBufferD = useMemo(() => (new ColorStorageWriteback(res)), [res]);

    const ComputeA = useMemo(() => {
        const sampleMinusGradient = (uv: THREE.Node) => {
            const veld = StorageBufferA.sampleBilinear(uv);
            // this should be buffer D
            const nbrs = StorageBufferD.sampleBilinearNbr(uv);
            const grad = vec2(nbrs.w.x.sub(nbrs.e.x), nbrs.s.x.sub(nbrs.n.x)).mul(0.5);
            return vec3(veld.xy.sub(grad), veld.z);
        }

        const programm = Fn(() => {
            const uv = StorageBufferA.uv()

            const gridOrigin = vec3(0.0);
            const worldPos = vec3(uv.x.sub(0.5).mul(size), 0.0, uv.y.sub(0.5).mul(size)).add(gridOrigin);

            //const velocity = StorageBufferA.sampleBilinear(uv).mul(0.9);
            //const veld = StorageBufferA.sampleBilinear(uv.add(velocity));
            const dissipation = 1;
            const velocity = sampleMinusGradient(uv).mul(dissipation).xy;
            const veld = sampleMinusGradient(uv.sub(velocity)).xyz;

            const vel = veld.xy;
            const d = veld.z;

            const player_mask = worldPos.sub(player.tsl_PlayerWorldPosition).length().step(0.75).oneMinus().mul(player.tsl_PlayerVelocity.length().min(1.0));

            // Add D and Vel
            const density_dissipation = float(0.999);
            const out_d = d.add(player_mask).min(1.0).mul(density_dissipation);
            const out_v = vel.add(player.tsl_PlayerVelocity.xz.mul(player_mask).mul(-0.01).mul(StorageBufferA.texelSize()))

            // Output
            StorageBufferA.output.element(instanceIndex).assign(vec4(out_v, out_d, 0.0));
        })().compute(res * res, [16, 16]);

        return programm;
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferD,
        player.tsl_PlayerWorldPosition,
        player.tsl_PlayerVelocity,
        dispatch_size
    ]);

    const ComputeB = useMemo(() => {
        const programm = Fn(() => {
            const _index = uint(instanceIndex)
            const n = StorageBufferA.nbr_values(_index);
            const divergence = n.w.x.sub(n.e.x).add(n.s.y).sub(n.n.y).mul(0.5);
            // Output
            StorageBufferB.current.element(instanceIndex).assign(divergence);
        })().compute(res * res, [16, 16]);

        // Compute And Writeback
        return programm;
    }, [
        res,
        size,
        StorageBufferA,
        StorageBufferB,
        player.tsl_PlayerWorldPosition,
        player.tsl_PlayerVelocity,
        renderer,
        dispatch_size
    ]);

    const ComputeC = useMemo(() => {

        const div = (x: number, y: number) => {
            return StorageBufferB.current.element(
                StorageBufferB.index2linear(StorageBufferB.linear2index(instanceIndex).add(ivec2(x, y)))
            ).x;
        };

        const pre = (x: number, y: number) => {
            return StorageBufferD.current.element(
                StorageBufferD.index2linear(StorageBufferD.linear2index(instanceIndex).add(ivec2(x, y)))
            ).x;
        };

        const kernel = generateDivWeights(10);
        const kernelPre = generatePreWeights(10);

        const getDiv = Fn(() => {
            const p = float(0.0).toVar();
            for (let i = 0; i < kernel.weights.length; i++) {
                const e = kernel.weights[i];
                p.addAssign(float(e.w).mul(div(e.x, e.y)));
            }
            return p.div(kernel.total);
        })

        const getPre = Fn(() => {
            const p = float(0.0).toVar();

            for (let i = 0; i < kernelPre.weights.length; i++) {
                const e = kernelPre.weights[i];

                p.addAssign(
                    float(e.w).mul(
                        pre(e.x, e.y)
                    )
                );
            }

            return p.div(kernelPre.total);
        });

        return Fn(() => {
            const div = getDiv();
            const p = getPre().sub(div);
            const out = vec4(p, div, 0.0, 0.0);

            StorageBufferC.current.element(instanceIndex).assign(out);
        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferB,
        StorageBufferC,
        StorageBufferD,
        player.tsl_PlayerWorldPosition,
        player.tsl_PlayerVelocity,
        renderer,
        dispatch_size
    ]);

    const ComputeD = useMemo(() => {
        const div = (x: number, y: number) => {
            return StorageBufferC.current.element(
                StorageBufferC.index2linear(StorageBufferC.linear2index(instanceIndex).add(ivec2(x, y)))
            ).y;
        };
        const pre = (x: number, y: number) => {
            return StorageBufferC.current.element(
                StorageBufferC.index2linear(StorageBufferC.linear2index(instanceIndex).add(ivec2(x, y)))
            ).x;
        };

        const kernelPre = generatePreWeights(10);

        const getPre = Fn(() => {
            const p = float(0.0).toVar();

            for (let i = 0; i < kernelPre.weights.length; i++) {
                const e = kernelPre.weights[i];

                p.addAssign(
                    float(e.w).mul(
                        pre(e.x, e.y)
                    )
                );
            }

            return p.div(kernelPre.total);
        });

        return Fn(() => {
            const p = getPre().sub(div(0, 0));
            const out = vec4(p, 0.0, 0.0, 0.0);

            StorageBufferD.current.element(instanceIndex).assign(out);
        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        StorageBufferC,
        StorageBufferD,
        player.tsl_PlayerWorldPosition,
        player.tsl_PlayerVelocity,
        renderer,
        dispatch_size
    ]);

    const frame = useRef(0)
    useFrame(() => {

        if (frame.current % 2 == 0) {
            // Update Position
            //const pwp = player.playerWorldPosition;
            //ref.current.position.setX(pwp.x - pwp.x % block_size);
            //ref.current.position.setZ(pwp.z - pwp.z % block_size);

            // Compute And Writeback
            renderer.compute(ComputeA, [dispatch_size, dispatch_size, 1]);
            renderer.compute(StorageBufferA.writebackCompute, [dispatch_size, dispatch_size, 1]);
            renderer.compute(ComputeB, [dispatch_size, dispatch_size, 1]);
            renderer.compute(ComputeC, [dispatch_size, dispatch_size, 1]);
            renderer.compute(ComputeD, [dispatch_size, dispatch_size, 1]);
        }
        frame.current += 1;

        if (controls.follow_player) {
            lights_group.current.position.copy(player.playerWorldPosition);
            uniforms.light_position.value.set( player.playerWorldPosition.x,player.playerWorldPosition.y + 5,player.playerWorldPosition.z);
        }

    })

    // Material
    const material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.wireframe = wireframe;
        mat.colorNode = float(.15);

        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1));
        //const worldUv = worldPos.xz.div(size);

        mat.colorNode = worldPos.fract().abs().step(0.5).mul(0.5).add(0.25).length();

        //mat.emissiveNode = StorageBufferA.current.element(vertexIndex).xy.mul(100).abs();
        //mat.emissiveNode = StorageBufferA.current.element(vertexIndex).z;
        //mat.emissiveNode = StorageBufferA.sampleBilinear(uv().setY(uv().y.oneMinus()));

        //mat.emissiveNode = StorageBufferB.current.element(vertexIndex).mul(100);
        //mat.emissiveNode = StorageBufferC.current.element(vertexIndex).mul(100);
        //mat.emissiveNode = StorageBufferD.current.element(vertexIndex).mul(1000);

        return mat;
    }, [res, size, wireframe])



    // Material
    const fog_material = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.wireframe = wireframe;
        mat.colorNode = float(0.0);


        mat.emissiveNode = StorageBufferA.current.element(vertexIndex).xy.mul(100).abs();
        //mat.emissiveNode = StorageBufferA.current.element(vertexIndex).z;
        //mat.emissiveNode = StorageBufferA.sampleBilinear(uv().setY(uv().y.oneMinus()));

        const vp_tex = viewportSharedTexture(screenUV);

        const sampleFog = (wp: THREE.Node) => {
            return StorageBufferA.sampleBilinear(wp.xz.div(size).add(0.5)).z.clamp(0, 1.0);
        }

        const calcTransmittance = Fn(() => {
            // Vectors
            const ro = modelWorldMatrix.mul(vec4(positionLocal, 1));
            const rd = ro.sub(cameraPosition).normalize();

            const viewPos = getViewPosition(screenUV.xy, viewportDepthTexture(screenUV).r, cameraProjectionMatrixInverse);
            const screenWp = cameraWorldMatrix.mul(vec4(viewPos));
            const mint = screenWp.sub(ro).dot(rd).abs();

            // Uniforms
            const fogHeight = 2.0;
            const slices = 32;
            const fogDensity = 2.;
            const fogSlice = float(fogHeight).div(slices);
            const light_pos = uniforms.light_position;
            const shadowDensity = float(1.0);

            // Calculated
            const fogStep = float(fogHeight / slices).mul(rd.div(rd.y.abs()));
            const stepLen = fogStep.length();


            // Vars 
            const curPos = modelWorldMatrix.mul(vec4(positionLocal, 1)).toVar("CurrentRayPosition");
            const transmittance = float(1.0).toVar("Transmittance");
            const lightEnergy = float(0.0).toVar("LigthEnergy");

            Loop(slices, ({ }) => {
                If(curPos.sub(ro).dot(rd).greaterThan(mint), () => { Break(); });

                const curHeight = sampleFog(curPos).mul(fogHeight);
                const curSample = clamp(curHeight.sub(curPos.y), float(0), fogSlice).mul(stepLen).div(fogSlice);

                // If sampled
                If(curSample.greaterThan(0.000001), () => {
                    // Calc Transmittance
                    const curDensity = curSample.mul(fogDensity);
                    transmittance.mulAssign(float(1.0).sub(curDensity).max(0.0));

                    // Calc Light
                    const light_dir = light_pos.sub(curPos).normalize();
                    const lightDist2 = light_pos.sub(curPos).length().pow(2);
                    //const light_dir = vec3(0,1,0).normalize();                    
                    //const lightDist2 = float(10.0);

                    const shadowStep = float(fogHeight).div(slices).mul(light_dir.div(light_dir.y));
                    const shadowPos = curPos.add(shadowStep).toVar("shadowPos");
                    const shadowDist = float(0.0).toVar("shadowDist");

                    // --- SHADOW MARCH ---
                    Loop(slices, ({ }) => {
                        shadowPos.addAssign(shadowStep);
                        If(shadowPos.y.greaterThan(fogHeight), () => { Break(); });
                        const shadowHeight = sampleFog(shadowPos).mul(fogHeight);
                        const shadowSample = clamp(
                            shadowHeight.sub(shadowPos.y),
                            float(0),
                            fogSlice
                        ).mul(shadowStep.length()).div(fogSlice);
                        shadowDist.addAssign(shadowSample);
                    });

                    // --- LIGHT ATTENUATION ---
                    const shadowFactor = shadowDist
                        .mul(-1.0)
                        .mul(shadowDensity)
                        .exp()
                        .div(lightDist2);

                    // --- IN-SCATTERING ---
                    const absorbedLight = shadowFactor.mul(curDensity);
                    lightEnergy.addAssign(absorbedLight.mul(transmittance));
                })

                // Move Along Ray
                curPos.addAssign(fogStep);
            });

            return vec2(lightEnergy, transmittance);
        })

        //mat.emissiveNode = sampleFog(worldPos).add(vp_tex);
        const fog = calcTransmittance()
        mat.emissiveNode = mix(vp_tex, vec3(1, 0.5, 0.5).mul(fog.r).mul(uniforms.ligth_intensity), fog.y.oneMinus());
        //mat.emissiveNode = calcTransmittance();

        return mat;
    }, [res, size, wireframe, uniforms])


    // res should be res-1 to match the thing
    return <group>
        <group ref={ref} >
            <mesh
                rotation={[-Math.PI * 0.5, 0, 0]}
                position={[0, 0, 0]}
                material={material}
            //renderOrder={998}
            >
                <planeGeometry args={[size * 2, size * 2, 2, 2]} />
            </mesh>

            <mesh
                rotation={[-Math.PI * 0.5, 0, 0]}
                position={[0, 2, 0]}
                material={fog_material}
                renderOrder={998}
            >
                <planeGeometry args={[size * 1, size * 1, 2, 2]} />
            </mesh>
        </group>

        <group ref={lights_group}>
            <pointLight position={[1, 10, 1]} intensity={controls.ligth_intensity} />

        </group>


    </group>

}








type WeightEntry = { x: number; y: number; w: number };

export function generateDivWeights(levels = 10): {
    weights: WeightEntry[];
    total: number;
} {
    const size = levels * 2 + 1;
    const center = levels;

    // 2D array
    const divTab: number[][] = Array.from({ length: size }, () =>
        Array(size).fill(0)
    );

    function recurse(x: number, y: number, level: number) {
        level--;

        // equivalent to: 1 << (level * 2)
        const weight = Math.pow(4, level);
        divTab[x][y] += weight;

        if (level > 0) {
            recurse(x - 1, y, level);
            recurse(x + 1, y, level);
            recurse(x, y - 1, level);
            recurse(x, y + 1, level);
        }
    }

    recurse(center, center, levels);

    // Convert to sparse list (like your shader)
    const weights: WeightEntry[] = [];
    let total = 0;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const w = divTab[x][y];
            if (w !== 0) {
                const dx = x - center;
                const dy = y - center;

                weights.push({ x: dx, y: dy, w });
                total += w;
            }
        }
    }

    // match your shader normalization (multiplier = 2)
    total *= 2;

    return { weights, total };
}

export function generatePreWeights(levels = 10): {
    weights: WeightEntry[];
    total: number;
} {
    const size = levels * 2 + 1;
    const center = levels;

    const preTab: number[][] = Array.from({ length: size }, () =>
        Array(size).fill(0)
    );

    function recurse(x: number, y: number, level: number) {
        level--;

        if (level > 0) {
            recurse(x - 1, y, level);
            recurse(x + 1, y, level);
            recurse(x, y - 1, level);
            recurse(x, y + 1, level);
        } else {
            // IMPORTANT: shifted neighbors like your C++
            preTab[x - 1][y]++;
            preTab[x + 1][y]++;
            preTab[x][y - 1]++;
            preTab[x][y + 1]++;
        }
    }

    recurse(center, center, levels);

    const weights: WeightEntry[] = [];
    let total = 0;

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const w = preTab[x][y];
            if (w !== 0) {
                const dx = x - center;
                const dy = y - center;

                weights.push({ x: dx, y: dy, w });
                total += w;
            }
        }
    }

    return { weights, total };
}
