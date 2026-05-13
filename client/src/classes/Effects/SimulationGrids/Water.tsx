import * as THREE from 'three/webgpu'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import {
    cameraProjectionMatrixInverse,
    cameraWorldMatrix,
    clamp,
    cos,
    float,
    Fn,
    getViewPosition,
    globalId,
    instancedArray,
    instanceIndex,
    int,
    max,
    min,
    mix,
    positionLocal,
    reflector,
    screenUV,
    select,
    smoothstep,
    texture,
    textureStore,
    transformNormalToView,
    uint,
    uniform,
    uvec2,
    vec2,
    vec3,
    vertexIndex,
    viewportDepthTexture,
    viewportSharedTexture,
} from 'three/tsl'

import { folder, useControls } from 'leva'
import { usePlayer } from '../../Player/PlayerContext'
import { useTerrain } from '../../Terrain/TerrainProvider'

type ReflectivePlaneProps = {
    size?: number
    height?: number
}

export function Water({
    size = 5000,
    height = 3.5,
}: ReflectivePlaneProps) {
    const { scene } = useThree()

    // --- TSL setup (runs once)
    const { material, reflectionTarget } = useMemo(() => {
        const mat = new THREE.MeshPhysicalNodeMaterial()

        // reflection node (this is the core)
        const reflection = reflector({ resolutionScale: 1, bounces: false })
        reflection.target.rotateX(-Math.PI / 2)
        reflection.target.translateZ(height);

        mat.colorNode = float(0);

        const water_depth = float(.75);
        // Depth based        
        //const vp_depth = viewportLinearDepth.mul(cameraFar.sub(cameraNear)).add(cameraNear);
        //const frag_depth = positionView.z.oneMinus();
        //const depth_mix = clamp(vp_depth.sub(frag_depth).div(water_depth), 0, 1);


        // Y world position based
        const viewPos = getViewPosition(screenUV.xy, viewportDepthTexture(), cameraProjectionMatrixInverse);
        const worldPos = cameraWorldMatrix.mul(viewPos);
        const depth_mix2 = clamp(worldPos.g.sub(height).mul(-1).div(water_depth), 0, 1);

        const vp_tex = viewportSharedTexture(screenUV);
        mat.emissiveNode = mix(vp_tex.mul(vec3(0.6, 0.9, 1.2)), vec3(0.0, 0.02, 0.03).add(reflection.mul(0.2)), depth_mix2);


        return {
            material: mat,
            reflectionTarget: reflection.target
        }
    }, [])

    // add reflector camera target to scene
    useEffect(() => {
        scene.add(reflectionTarget)
        return () => {
            scene.remove(reflectionTarget)
        }
    }, [scene, reflectionTarget])

    return (
        <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            material={material}
            receiveShadow
            position={[0, height, 0]}
            renderOrder={999}
        >
            <planeGeometry args={[size, size]} />
        </mesh>
    )
}




export function PlayerDrawTexture() {

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    const player = usePlayer();

    const res = 512;
    const size = 50;
    const storageTexture = useMemo(() => new THREE.StorageTexture(res, res), [res]);

    const uvToWorldXZ = Fn(([uv, size]: [THREE.Node, number]) => {
        const centered = uv.sub(0.5).mul(size);
        return vec3(centered.x, 0.0, centered.y.negate());
    });

    const computeTexture = useMemo(() => {

        return Fn(([storageTexture]: [THREE.StorageTexture]) => {

            const posX = instanceIndex.mod(res);
            const posY = instanceIndex.div(res);
            const indexUV = uvec2(posX, posY);

            const localUV = vec2(indexUV).div(res);
            const worldPos = uvToWorldXZ(localUV, size);

            const player_dist = player.tsl_PlayerWorldPosition.mul(vec3(1, 0, 1)).sub(worldPos);

            //player_dist.length().step(0.5)
            const out = player_dist;
            textureStore(storageTexture, indexUV, out).toWriteOnly();

        });
    }, [res, player.tsl_PlayerWorldPosition, size]);

    const computeNode = useMemo(() => {
        return computeTexture(storageTexture).compute(res * res);
    }, [computeTexture, storageTexture, res]);

    useFrame(() => {
        renderer.compute(computeNode);
    });


    const { material } = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.colorNode = texture(storageTexture);

        return {
            material: mat,
        }
    }, [])


    return <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 5.5, 0]}
        material={material}
        scale={size}
    >
        <planeGeometry args={[1, 1]} />
    </mesh>


}


export function DynamicWaterSystemToggle() {
    const waterControls = useControls("Terrain", {
        Water: folder({
            enabled: { value: true },
        }, { collapsed: true })
    });

    return <>{ waterControls.enabled && <DynamicWaterSystem />}</>;    

}



export function DynamicWaterSystem() {

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    const player = usePlayer();

    const waterControls = useControls("Terrain", {
        Water: folder({
            res: { value: 256, min: 64, max: 1024, step: 1 },
            size: { value: 32, min: 1, max: 200 },
            waterline_height: { value: 3.5, min: -10, max: 20 },

            mouseDeep: { value: 0.1, min: 0, max: 2 },
            mouseSize: { value: 0.3, min: 0.01, max: 5 },
            viscosity: { value: 0.98, min: 0.8, max: 0.9999 },
        }, { collapsed: true })
    });

    const { res, size, waterline_height, mouseDeep, mouseSize, viscosity } = waterControls;

    const uniforms = useMemo(() => ({
        mouseDeep: uniform(.1).setName('mouseDeep'),
        mouseSize: uniform(0.3).setName('mouseSize'),
        viscosity: uniform(0.98).setName('viscosity'),
        waterline_height: uniform(3.5).setName('waterline_height'),
    }), []);

    useEffect(() => {
        uniforms.mouseDeep.value = mouseDeep;
        uniforms.mouseSize.value = mouseSize;
        uniforms.viscosity.value = viscosity;
        uniforms.waterline_height.value = waterline_height;
    }, [mouseDeep, mouseSize, viscosity, waterline_height, uniforms]);

    // Initialize Arrays
    const [heightArray, prevHeightArray] = useMemo(() => {
        const arr_size = res * res;
        const height = new Float32Array(arr_size);
        const prev = new Float32Array(arr_size);
        return [height, prev];
    }, [res]);

    // Initialize Storages
    const [heightStorageA, heightStorageB, prevHeightStorage] = useMemo(() => {
        const heightStorageA = instancedArray(heightArray).setName('HeightA');
        const heightStorageB = instancedArray(new Float32Array(heightArray)).setName('HeightB');
        const prevHeightStorage = instancedArray(prevHeightArray).setName('PrevHeight');
        return [heightStorageA, heightStorageB, prevHeightStorage];
    }, [heightArray, prevHeightArray]);


    const gridDeltaOffset = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);

    const getOffsetIndex = useCallback((index: THREE.Node) => {
        const width = uint(res);

        const x = int(index.mod(width));
        const y = int(index.div(width));
        const maxX = width.sub(1);

        const new_x = clamp(x.add(gridDeltaOffset.x), 0, maxX);
        const new_y = clamp(y.add(gridDeltaOffset.z), 0, maxX);

        const offsetIndex = new_y.mul(width).add(new_x);

        return offsetIndex;

    }, [res]);


    // Get Indices of Neighbor Values of an Index in the Simulation Grid
    const getNeighborIndicesTSL = useCallback((index: THREE.Node) => {
        const width = uint(res);

        const x = int(index.mod(width));
        const y = int(index.div(width));

        const maxX = width.sub(1);

        const leftX = max(0, x.sub(1));
        const rightX = min(x.add(1), maxX);

        const bottomY = max(0, y.sub(1));
        const topY = min(y.add(1), maxX);

        const westIndex = y.mul(width).add(leftX);
        const eastIndex = y.mul(width).add(rightX);

        const southIndex = bottomY.mul(width).add(x);
        const northIndex = topY.mul(width).add(x);

        return { northIndex, southIndex, eastIndex, westIndex };

    }, [res]);

    const getNeighborValuesTSL = useCallback((index: THREE.Node, store: any) => {
        const { northIndex, southIndex, eastIndex, westIndex } =
            getNeighborIndicesTSL(index);

        const north = store.element(northIndex);
        const south = store.element(southIndex);
        const east = store.element(eastIndex);
        const west = store.element(westIndex);

        return { north, south, east, west };

    }, [getNeighborIndicesTSL]);


    const terrain = useTerrain();

    const gridOrigin = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);

    const createComputeHeight = useMemo(() => {
        return ([readBuffer, writeBuffer]: [THREE.StorageBufferNode, THREE.StorageBufferNode]) => Fn(() => {

            const { viscosity, mouseSize, mouseDeep } = uniforms;

            const _index = uint(getOffsetIndex(instanceIndex))

            const height = readBuffer.element(_index).toVar();
            const prevHeight = prevHeightStorage.element(_index).toVar();

            const { north, south, east, west } = getNeighborValuesTSL(_index, readBuffer);

            const neighborHeight = north.add(south).add(east).add(west);
            neighborHeight.mulAssign(0.5);
            neighborHeight.subAssign(prevHeight);


            // Clalc Worl pos
            const uv = vec2(globalId.xy).div(res);
            const worldPos = vec3(uv.x.sub(0.5).mul(size), 0.0, uv.y.sub(0.5).mul(size)).add(gridOrigin);


            const half_size = size * 0.5;
            const edge_width = half_size * 0.1;
            const edge_mask = smoothstep(0, 1, worldPos.sub(player.tsl_PlayerWorldPosition).setY(float(0)).length().sub(half_size).negate().div(edge_width).clamp(0, 1));

            const newHeight = neighborHeight.mul(viscosity);

            // Offset By Player
            const playerPhase = clamp(worldPos.sub(player.tsl_PlayerWorldPosition.mul(vec3(1, 0, 1))).length().mul(Math.PI).div(mouseSize), 0.0, Math.PI);
            newHeight.addAssign(cos(playerPhase).add(1.0).mul(mouseDeep).mul(
                player.tsl_PlayerVelocity.length().mul(0.1).min(1)
            ));

            // Clamp By Terrain
            newHeight.mulAssign(terrain.tsl_sampleHeight(worldPos).step(uniforms.waterline_height).oneMinus())

            // Splash          
            /*                     
            const splashRadius = float(0.2);
            const seed = vec2(1.0,time);
            const splash_chance = rand(vec2(4.0,time)).step(0.6);
            const splashWorld = vec3(rand(seed.setX(float(2))).sub(0.5).mul(size), 0.0, rand(seed).sub(0.5).mul(size)).add(gridOrigin);
            const splashDist = worldPos.sub(splashWorld).setY(float(0)).length();
            const splashPhase = clamp(splashDist.mul(Math.PI).div(splashRadius), 0.0, Math.PI);
            newHeight.addAssign(cos(splashPhase).add(1.0).mul(splash_chance).mul(0.1));
            */

            // Clamp Edges
            newHeight.mulAssign(edge_mask);
            //newHeight.assign( mix(height,newHeight,edge_mask)  );

            prevHeightStorage.element(instanceIndex).assign(height.mul(edge_mask));
            writeBuffer.element(instanceIndex).assign(newHeight);

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        prevHeightStorage,
        getNeighborValuesTSL,
        uniforms,
        player.tsl_PlayerWorldPosition,
        player.tsl_PlayerVelocity,
        terrain.getHeightAtPos,
        getOffsetIndex,
    ]);

    const [computeHeightAtoB, computeHeightBtoA] = useMemo(() => {
        const computeHeightAtoB = createComputeHeight([heightStorageA, heightStorageB]).setName('Update Height A→B');
        const computeHeightBtoA = createComputeHeight([heightStorageB, heightStorageA]).setName('Update Height B→A');
        return [computeHeightAtoB, computeHeightBtoA];
    }, [createComputeHeight, heightStorageA, heightStorageB]);


    const readFromA = useMemo(() => uniform(1), []);

    // Helper to get height from the current read buffer
    const getCurrentHeight = useCallback((index: THREE.Node) => {
        return select(readFromA, heightStorageA.element(index), heightStorageB.element(index));
    }, [readFromA, heightStorageA, heightStorageB]);

    const getCurrentNormals = useMemo(() => {
        return (index: THREE.Node) => {
            const { northIndex, southIndex, eastIndex, westIndex } = getNeighborIndicesTSL(index);

            const north = getCurrentHeight(northIndex);
            const south = getCurrentHeight(southIndex);
            const east = getCurrentHeight(eastIndex);
            const west = getCurrentHeight(westIndex);

            const normalX = (west.sub(east)).mul(res / size);
            const normalY = (south.sub(north)).mul(res / size);

            return { normalX, normalY };
        };
    }, [
        getNeighborIndicesTSL,
        getCurrentHeight,
        res,
        size
    ]);



    const frameRef = useRef(0);
    const pingPongRef = useRef(0);
    const dispatch_size = useMemo(() => res / 16, [res])

    const ref = useRef<THREE.Mesh>(null!);

    const block_size = useMemo( () => {return size / (res - 1)} ,[res,size] );

    useFrame(() => {
        frameRef.current++;
        if (frameRef.current >= 7 - 5) {

            const pwp = player.playerWorldPosition;

            const prev_pos_x = ref.current.position.x;
            const prev_pos_z = ref.current.position.z;

            ref.current.position.setX(pwp.x - pwp.x % block_size);
            ref.current.position.setZ(pwp.z - pwp.z % block_size);

            // Update Origin Uniform
            gridOrigin.value.set(ref.current.position.x, 0, ref.current.position.z);
            gridDeltaOffset.value.set(
                Math.round((ref.current.position.x - prev_pos_x) / block_size),
                0,
                Math.round((ref.current.position.z - prev_pos_z) / block_size)
            )

            const pingPong = pingPongRef.current;

            if (pingPong === 0) {
                renderer.compute(computeHeightAtoB, [dispatch_size, dispatch_size, 1]);
                readFromA.value = 0; // now read B
            } else {
                renderer.compute(computeHeightBtoA, [dispatch_size, dispatch_size, 1]);
                readFromA.value = 1; // now read A
            }

            pingPongRef.current = 1 - pingPong;
            frameRef.current = 0;
        }

    }, -30);

    const { material, reflectionTarget } = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.colorNode = float(0.5);

        const water_height = getCurrentHeight(vertexIndex);
        mat.positionNode = vec3(positionLocal.x, positionLocal.y, water_height);
        //mat.colorNode = getCurrentHeight(vertexIndex).mul(20);

        const { normalX, normalY } = getCurrentNormals(vertexIndex);
        const normal = vec3(normalX, normalY.negate(), 1.0).normalize()
        mat.normalNode = transformNormalToView(normal).toVertexStage();

        // reflection
        const reflection = reflector({ resolutionScale: 1, bounces: false })
        reflection.target.rotateX(-Math.PI / 2)
        reflection.target.translateZ(waterline_height);
        // offset reflection Normal
        const normalOffset = normal.xy.mul(.2);
        reflection.uvNode = reflection.uvNode!.add(normalOffset);


        // Color And REFLECTION
        mat.colorNode = float(0);
        //mat.emissiveNode = reflection.mul(0.2).add(water_height.abs().mul(0.2));

        const water_depth = float(1);
        // Y world position based
        const viewPos = getViewPosition(screenUV.xy, viewportDepthTexture(), cameraProjectionMatrixInverse);
        const worldPos = cameraWorldMatrix.mul(viewPos);
        const depth_mix2 = clamp(worldPos.g.sub(waterline_height).mul(-1).div(water_depth), 0, 1);

        const vp_tex = viewportSharedTexture(screenUV.add(normalOffset));
        mat.emissiveNode = mix(vp_tex.mul(vec3(0.6, 0.9, 1.2)), vec3(0.0, 0.02, 0.03).add(reflection.mul(0.2)), depth_mix2)
            .add(water_height.abs().mul(0.1));

        //mat.wireframe = true;

        return {
            material: mat,
            reflectionTarget: reflection.target,            
        }
    }, [
        waterline_height,
        getCurrentHeight, 
        getCurrentNormals, 
        res, 
        size
    ])


    const { scene } = useThree()
    // add reflector camera target to scene
    useEffect(() => {
        scene.add(reflectionTarget)
        return () => { scene.remove(reflectionTarget) }
    }, [scene, reflectionTarget])

    const farGeo = useMemo(() => {
        const side_n = 4;
        const n = side_n * 2 + 1;
        const geometry = new THREE.PlaneGeometry(size * n, size * n, n, n);

        const start_index = (2 * side_n * (side_n + 1)) * 2 * 3

        geometry.index!.array[start_index] = 0;
        geometry.index!.array[start_index + 1] = 0;
        geometry.index!.array[start_index + 2] = 0;
        geometry.index!.array[start_index + 3] = 0;
        geometry.index!.array[start_index + 4] = 0;
        geometry.index!.array[start_index + 5] = 0;

        geometry.index!.needsUpdate = true;

        return geometry;
    }, [res, size])

    useEffect( () => {console.log("update res",res)}, [res])

    return <group ref={ref}  key={`geo-${res}`}>
        <mesh
            rotation={[-Math.PI * 0.5, 0, 0]}
            position={[0, waterline_height, 0]}
            material={material}
            renderOrder={998}
        >
            <planeGeometry args={[size, size, res - 1, res - 1]} />
        </mesh>

        <mesh
            rotation={[-Math.PI * 0.5, 0, 0]}
            position={[0, waterline_height, 0]}
            renderOrder={999}
            material={material}
            geometry={farGeo}
        >
        </mesh>


    </group>


}
