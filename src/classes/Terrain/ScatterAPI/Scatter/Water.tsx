import * as THREE from 'three/webgpu'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import {
    cameraFar,
    cameraNear,
    cameraProjectionMatrixInverse,
    cameraWorldMatrix,
    clamp,
    color,
    cos,
    depth,
    float,
    Fn,
    getViewPosition,
    globalId,
    grayscale,
    instancedArray,
    instanceIndex,
    int,
    length,
    max,
    min,
    mix,
    pass,
    positionLocal,
    positionView,
    reflector,
    screenUV,
    select,
    texture,
    textureLoad,
    textureStore,
    uint,
    uniform,
    uvec2,
    vec2,
    vec3,
    vec4,
    vertexIndex,
    viewportDepthTexture,
    viewportLinearDepth,
    viewportSharedTexture,
} from 'three/tsl'
import { usePlayer } from '../../../Player/PlayerContext'
import { useTerrain } from '../../TerrainProvider'

type ReflectivePlaneProps = {
    size?: number
    height?: number
}

export function Water({
    size = 5000,
    height = 3.5,
}: ReflectivePlaneProps) {
    const { scene, camera } = useThree()

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
        const vp_depth = viewportLinearDepth.mul(cameraFar.sub(cameraNear)).add(cameraNear);
        const frag_depth = positionView.z.oneMinus();
        const depth_mix = clamp(vp_depth.sub(frag_depth).div(water_depth), 0, 1);


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




export function PlayerDrawCompute() {

    const { gl } = useThree();
    //@ts-ignore
    const renderer = gl as THREE.WebGPURenderer

    const player = usePlayer();

    const res = 64;
    const size = 45;

    const uniforms = {
        mousePos: uniform(new THREE.Vector2()).setName('mousePos'),
        mouseSpeed: uniform(new THREE.Vector2()).setName('mouseSpeed'),
        mouseDeep: uniform(.75).setName('mouseDeep'),
        mouseSize: uniform(0.2).setName('mouseSize'),
        viscosity: uniform(0.96).setName('viscosity'),
    };

    // Initialize Arrays
    const [heightArray, prevHeightArray] = useMemo(() => {
        const size = res * res;

        const height = new Float32Array(size);
        const prev = new Float32Array(size);

        return [height, prev];
    }, [res]);

    // Initialize Storages
    const [heightStorageA, heightStorageB, prevHeightStorage] = useMemo(() => {
        const heightStorageA = instancedArray(heightArray).setName('HeightA');
        const heightStorageB = instancedArray(new Float32Array(heightArray)).setName('HeightB');
        const prevHeightStorage = instancedArray(prevHeightArray).setName('PrevHeight');
        return [heightStorageA, heightStorageB, prevHeightStorage];
    }, [heightArray, prevHeightArray]);

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

    const createComputeHeight = useMemo(() => {
        return ([readBuffer, writeBuffer]: [THREE.StorageBufferNode, THREE.StorageBufferNode]) => Fn(() => {

            const { viscosity, mousePos, mouseSize, mouseDeep, mouseSpeed } = uniforms;

            const height = readBuffer.element(instanceIndex).toVar();
            const prevHeight = prevHeightStorage.element(instanceIndex).toVar();

            const { north, south, east, west } = getNeighborValuesTSL(instanceIndex, readBuffer);

            const neighborHeight = north.add(south).add(east).add(west);
            neighborHeight.mulAssign(0.5);
            neighborHeight.subAssign(prevHeight);

            const newHeight = neighborHeight.mul(viscosity);

            // UV coords
            const x = float(globalId.x).mul(1 / res);
            const y = float(globalId.y).mul(1 / res);

            const centerVec = vec2(0.5);
            const mousePhase = clamp(length(vec2(x, y).sub(centerVec).mul(size).sub(mousePos)).mul(Math.PI).div(mouseSize), 0.0, Math.PI);
            newHeight.addAssign(cos(mousePhase).add(1.0).mul(mouseDeep).mul(mouseSpeed.length()));

            // add player
            const uv = vec2(globalId.xy).div(res);
            const worldPos = vec3(uv.x.sub(0.5).mul(size), 0.0, uv.y.sub(0.5).mul(size));
            const playerPhase = clamp(worldPos.sub(player.tsl_PlayerWorldPosition.mul(vec3(1,0,1))).length().mul(Math.PI).div(mouseSize), 0.0, Math.PI);

            newHeight.addAssign(cos(playerPhase).add(1.0).mul(mouseDeep));

            newHeight.mulAssign(terrain.tsl_sampleHeight(worldPos).step(5.5).oneMinus())

            prevHeightStorage.element(instanceIndex).assign(height);
            writeBuffer.element(instanceIndex).assign(newHeight);

        })().compute(res * res, [16, 16]);
    }, [
        res,
        size,
        prevHeightStorage,
        getNeighborValuesTSL,
        uniforms,
        player.tsl_PlayerWorldPosition,
        terrain.getHeightAtPos
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




    const frameRef = useRef(0);
    const pingPongRef = useRef(0);
    const dispatch_size = useMemo( () => res/16, [res])

    useFrame(() => {
        frameRef.current++;

        const player_world_pos = player.playerWorldPosition;


        if (frameRef.current >= 7 - 3) {

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

    });

    const { material } = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        mat.colorNode = float(0.5);
        //mat.wireframe = true;


        mat.positionNode = vec3(positionLocal.x, positionLocal.y, getCurrentHeight(vertexIndex));
        mat.colorNode = getCurrentHeight(vertexIndex).mul(20);

        return {
            material: mat,
        }
    }, [])


    return <mesh
        rotation={[-Math.PI * 0.5, 0, 0]}
        position={[0, 5.5, 0]}
        material={material}
    >
        <planeGeometry args={[size, size, res - 1, res - 1]} />
    </mesh>


}
