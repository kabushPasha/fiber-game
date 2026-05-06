import { useTexture } from "@react-three/drei";
import { GLTFGeometry, GrassScatter } from "../../../Terrain/ScatterAPI/Scatter/TransformsProvides";
import * as THREE from "three/webgpu"
import { normalLocal, positionLocal, texture, uv, vec2, vec3 } from "three/tsl";
import { useEffect, useMemo, useRef } from "react";
import { ParentWorldPositionConstraint, WorldPositionConstraint } from "../../../ParentConstraints/WorldPositionConstraint";
import { CameraUniformsProvider } from "../../../PostProcessing/cameraUniformsContext";
import { WebGPUPostProcessingProvider } from "../../../PostProcessing/PostProcessingContext";
import { PP_Vignette } from "../../../PostProcessing/Effects/PP_Dof";
import { PP_PalDither } from "../../../PostProcessing/Effects/PP_PalDither";
import { Pixelated } from "../../../../components/Pixelated";
import { TerrainProvider } from "../../../Terrain/TerrainProvider";
import { Player } from "../../../Player/Player";
import { TerrainPlane } from "../../../Terrain/Terrain";
import { GroundClamp, Jump, MoveByVel } from "../../../Player/PlayerPhysics";
import { PinesScatter } from "../../../Terrain/ScatterAPI/Scatter/Presets";
import { SnowSpritesUI } from "../../../Terrain/SnowSprites";
import { DynamicWaterSystemToggle } from "../../../Terrain/ScatterAPI/Scatter/Water";
import { SimpleBackground } from "../../../shaders/Aurora";
import { useFrame, useThree } from "@react-three/fiber";
import { usePlayer } from "../../../Player/PlayerContext";



export function Knight() {
    const map = useTexture("models/Char/Knight.png")
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = 'srgb'

    const groupRef = useRef<THREE.Group>(null!)
    const player = usePlayer()

    const customMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();

        const flippedUV = vec2(uv().x, uv().y.oneMinus())
        const materialColor = texture(map, flippedUV);
        material.colorNode = materialColor.clamp(0, 1);

        return material;
    }, [map]);

    const outlineMaterial = useMemo(() => {
        const material = new THREE.MeshBasicNodeMaterial();
        material.side = THREE.BackSide;

        material.positionNode = positionLocal.add(normalLocal.mul(0.05));


        material.colorNode = vec3(0.0);

        return material;
    }, [map]);

    const scale = 2.5;

    useFrame(() => {
        const velocity = player.player?.userData.vel;

        if (velocity && (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.z) > 0.001)) {
            const angle = Math.atan2(-velocity.x, -velocity.z);
            groupRef.current.rotation.y = angle;
        }
    })



    return <ParentWorldPositionConstraint>
        <group ref={groupRef}>
            <mesh scale={scale} rotation={[0, Math.PI, 0]} material={customMaterial}>
                <GLTFGeometry url="models/Char/Knight1.glb" />
            </mesh>

            <mesh scale={scale} rotation={[0, Math.PI, 0]} material={outlineMaterial}>
                <GLTFGeometry url="models/Char/Knight1.glb" />
            </mesh>
        </group>
    </ParentWorldPositionConstraint>
        ;

}


export function PixelCameraSnap({ children }: React.PropsWithChildren<{}>) {
    const { scene, camera, gl } = useThree()
    const parentRef = useRef<THREE.Group>(null!)

    const groupRef = useRef<THREE.Group>(null!)
    const camOrient = new THREE.Quaternion()
    const parentOrient = new THREE.Quaternion()
    const parentWorld = new THREE.Vector3()

    // Detach from parent on mount
    useEffect(() => {
        const g = groupRef.current
        if (!g) return
        g.updateWorldMatrix(true, false)
        g.getWorldPosition(parentWorld)
        scene.add(g)
        g.position.copy(parentWorld)
        return () => { scene.remove(g) }
    }, [scene])


    useFrame(() => {
        const parent = parentRef.current
        const g = groupRef.current
        if (!parent || !g) return

        parent.getWorldPosition(parentWorld)
        parent.getWorldQuaternion(parentOrient)

        const cam = camera as THREE.OrthographicCamera;
        if (!cam.isOrthographicCamera) {
            g.position.copy(parentWorld);
            g.rotation.setFromQuaternion(parentOrient);
            return;
        }

        cam.getWorldQuaternion(camOrient)

        const snap = (value: number, size: number) => Math.round(value / size) * size;

        const worldUnitsPerPixel = (cam.top - cam.bottom) / cam.zoom / gl.domElement.height;
        const worldUnitsPerPixel2 = (cam.right - cam.left) / cam.zoom / gl.domElement.width;

        // camera basis vectors
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camOrient);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camOrient);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camOrient);

        // project into camera plane coordinates
        const x = parentWorld.dot(right);
        const y = parentWorld.dot(up);

        // snap in pixel-aligned world units
        const snappedX = snap(x, worldUnitsPerPixel2);
        const snappedY = snap(y, worldUnitsPerPixel);

        // rebuild position      
        g.position
            .copy(right.multiplyScalar(snappedX))
            .add(up.multiplyScalar(snappedY))
            .add(forward.multiplyScalar(parentWorld.dot(forward)));

        //g.position.copy(parentWorld);

        g.rotation.setFromQuaternion(parentOrient)

        // Update Canvas Offset 
        /*
        const client_width = gl.domElement.clientWidth;
        const pixel_scale = client_width / gl.domElement.width;
        const screen_offsetX = -pixel_scale * (x - snappedX) / worldUnitsPerPixel2;
        const screen_offsetY = pixel_scale * (y - snappedY) / worldUnitsPerPixel;
        let scale = gl.domElement.height / (gl.domElement.height - 1);
        gl.domElement.style.transform = `scale(${scale}) translate(${screen_offsetX}px, ${screen_offsetY}px)`;
        */

        cam.userData["pixel_grid_offset"] = [snappedX / worldUnitsPerPixel2, -snappedY / worldUnitsPerPixel];
    }, -10)




    return <group ref={parentRef}>
        <group ref={groupRef}>{children}</group>
    </group>
}



export function KnightLevel() {

    return <>
        {1 &&
            <CameraUniformsProvider>
                <WebGPUPostProcessingProvider >
                    {1 && <>
                        <PP_Vignette />
                        {0 && <PP_PalDither palette="slso8-1x.png" dither={0.01} />}
                    </>}
                </WebGPUPostProcessingProvider>
            </CameraUniformsProvider>
        }


        <Pixelated resolution={128} enabled={true} />

        <group name="Lights">
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 5, 0]} intensity={0.5} />
        </group>

        <TerrainProvider textureUrl="textures/HFs/height.png">

            <Player camera_props={{ default_pitch: 45, min_pitch: 0.3, max_pitch: 1.0, ortho: true }} show_sphere={false}>
                <WorldPositionConstraint>
                    {1 && <TerrainPlane />}
                </WorldPositionConstraint>
                {1 && <MoveByVel speed={0.5} />}
                <Jump />
                <GroundClamp />

                <Knight />
            </Player>

            {1 && <>
                {1 && <GrassScatter />}
                {1 && <PinesScatter />}
                {1 && <SnowSpritesUI active={true} showControls={true} fallSpeed={0.0} areaSize={100} count={1000} />}
                {0 && <DynamicWaterSystemToggle />}
            </>}

        </TerrainProvider>

        {0 && <SimpleBackground />}
    </>
}






