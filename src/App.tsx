import { Canvas } from "@react-three/fiber"
import "./App.css"
import * as THREE from "three/webgpu"

import { KeyboardControls, Stats } from "@react-three/drei"
import { Player } from "./classes/Player/Player"
import { Pixelated } from "./components/Pixelated"
import { UIScreenProvider } from "./components/UIScreenContext"
import { TaskSelectorPawn } from "./classes/FPS/Components/TaskSelector"
import { AuroraBackground, SimpleBackground } from "./classes/shaders/Aurora"
import { TestSDF } from "./classes/shaders/Raymarcher"


import { extend } from "@react-three/fiber"
import { MeshStandardNodeMaterial, } from "three/webgpu"
import { TestTslShader } from "./classes/shaders/SimpleTslGrid"
import { TerrainMossUI, TerrainPlane } from "./classes/Terrain/Terrain"


//import { Physics } from "@react-three/rapier";
import { useCallback, useEffect, useState } from "react"
import { TerrainProvider } from "./classes/Terrain/TerrainProvider"
import { GroundClamp, Jump, MoveByVel } from "./classes/Player/PlayerPhysics"
import { WorldPositionConstraint } from "./classes/ParentConstraints/WorldPositionConstraint"
import { MouseLockProvider } from "./classes/Player/MouseLock"
import { WebGPUPostProcessingProvider } from "./classes/PostProcessing/PostProcessingContext"

import { Leva, useControls } from 'leva';
import { SnowSpritesUI } from "./classes/Terrain/SnowSprites"
import { PlayerProvider } from "./classes/Player/PlayerContext"
import { RaycastOnClick } from "./classes/Player/RaycastOnClick"
import { PP_FogPass } from "./classes/PostProcessing/Effects/PP_FogPass"
import { PP_PixelHighlights } from "./classes/PostProcessing/Effects/PP_PixelatedPass"
import { CameraUniformsProvider } from "./classes/PostProcessing/cameraUniformsContext"

import { GrassScatter, InteractiveBoxesScatter } from "./classes/Terrain/ScatterAPI/Scatter/TransformsProvides"
import { PinesScatter } from "./classes/Terrain/ScatterAPI/Scatter/Presets"
import { PP_LUT } from "./classes/PostProcessing/Effects/PP_3DLUTPass"
import { PP_ColorGrading } from "./classes/PostProcessing/Effects/PP_ColorGrading"
import { PP_Sharpen } from "./classes/PostProcessing/Effects/PP_Sharpen"
import { PP_DoF, PP_Scanline, PP_Vignette } from "./classes/PostProcessing/Effects/PP_Dof"
import AspectRatioCanvas from "./components/AspectRationCanvas"
import { LoadingScreen } from "./components/LoadingScreen"
import { Pause } from "./classes/Player/Pause"
import { DynamicWaterSystemToggle, Water } from "./classes/Terrain/ScatterAPI/Scatter/Water"
import { SatinLevel } from "./classes/Terrain/ScatterAPI/Scatter/SatinFlow"
import { DryIceLevel } from "./classes/Terrain/ScatterAPI/Scatter/DryIce"
import { UI_Panel } from "./classes/UI_Panels/UI_Panel"
import { Badge } from "react-bootstrap"

extend({ MeshStandardNodeMaterial })

export const inputMap = [
  { name: "forward", keys: ["ArrowUp", "w", "W", "Ц", "ц"] },
  { name: "backward", keys: ["ArrowDown", "s", "S", "Ы", "ы"] },
  { name: "left", keys: ["ArrowLeft", "a", "A", "Ф", "ф"] },
  { name: "right", keys: ["ArrowRight", "d", "D", "В", "в"] },
  { name: "jump", keys: ["Space"] },
  { name: "shift", keys: ["Shift"] },
  { name: "pause", keys: ["Backspace"] },
]


const App = () => {

  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(2)

  const pickLevel = useCallback((level: number) => {
    setLoading(true)
    setLevel(-1)
    setTimeout(() => setLevel(level), 0)
  }, [])



  return (
    <>

      <UIScreenProvider>
        <AspectRatioCanvas aspectRatio="235/100">
          {false && <Leva collapsed />}

          <Canvas
            camera={{ fov: 50, aspect: 2.35, position: [0, 0, 0] }}

            gl={async (props) => {
              const renderer = new THREE.WebGPURenderer({
                ...props,
                antialias: false,
              } as any)

              await renderer.init()
              return renderer
            }}
            style={{ background: "black" }}
            key={level}
          >
            <Stats />

            <PlayerProvider>
              <MouseLockProvider>
                <KeyboardControls map={inputMap} >

                  <UI_Panel >
                    <h2><Badge bg="secondary">Level Select</Badge></h2>
                    <button className="btn btn-primary  btn-sm" onClick={() => pickLevel(0)}>Level 1: The Woods</button>
                    <button className="btn btn-primary  btn-sm" onClick={() => pickLevel(1)}>Level 2: Cloth Flow</button>
                    <button className="btn btn-primary  btn-sm" onClick={() => pickLevel(2)}>Level 3: Smoke Test</button>
                  </UI_Panel>

                  {/** LEVELS */}
                  {level == 0 && <ForestLevel />}
                  {level == 1 && <SatinLevel />}
                  {level == 2 && <DryIceLevel />}



                </KeyboardControls>
              </MouseLockProvider>
            </PlayerProvider>


            {level != -1 && <EverythingIsLoaded onLoaded={() => { setLoading(false) }} />}

          </Canvas>
        </AspectRatioCanvas>
      </UIScreenProvider>

      <LoadingScreen loading={loading} />


    </>
  )
}

export function EverythingIsLoaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => { onLoaded(); }, [onLoaded]);
  return null;
}

export function ForestLevel() {

  const controlls = useControls("Lights", {
    ambient_intensity: { value: 0.5, min: 0, max: 5 },
    directional_intensity: { value: 0.6, min: 0, max: 3 },
    directional_angle: { value: { x: 0, y: 0, z: 0 } },
  }, { collapsed: true });

  return <>
    {1 &&
      <CameraUniformsProvider>
        <WebGPUPostProcessingProvider >
          <PP_PixelHighlights />
          <PP_FogPass density={0.5 * 0.01} heightFalloff={0.01} />
          <PP_Sharpen />
          <PP_DoF />
          <PP_ColorGrading />
          <PP_LUT />
          <PP_Vignette />
          <PP_Scanline />
        </WebGPUPostProcessingProvider>
      </CameraUniformsProvider>
    }

    <Pixelated resolution={256} enabled={true} />

    <group name="Lights">
      <ambientLight intensity={controlls.ambient_intensity} />
      <directionalLight position={[10, 5, 0]} intensity={controlls.directional_intensity} />
    </group>

    <TerrainProvider textureUrl="textures/HFs/height.png">

      <Player >
        <WorldPositionConstraint>
          {1 && <TerrainPlane />}
        </WorldPositionConstraint>
        {1 && <MoveByVel />}
        <Jump />
        <GroundClamp />
      </Player>

      {1 && <>
        {0 && <Water />}
        {/** Geometry */}
        {1 && <GrassScatter />}
        {1 && <InteractiveBoxesScatter />}
        {1 && <PinesScatter />}
        {1 && <TerrainMossUI />}
        {1 && <DynamicWaterSystemToggle />}

        {1 && <SnowSpritesUI active={true} showControls={true} />}
      </>}

    </TerrainProvider>

    {false && <Pause />}

    {1 && <SimpleBackground />}

    {0 && <TaskSelectorPawn />}
    {0 && <AuroraBackground />}
    {0 && <TestSDF />}
    {false && <TestTslShader />}
    {0 && <RaycastOnClick />}
  </>
}




export default App;