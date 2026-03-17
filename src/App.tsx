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
import { TerrainPlane } from "./classes/Terrain/Terrain"


import { Physics } from "@react-three/rapier";
import { Suspense } from "react"
import { TerrainProvider } from "./classes/Terrain/TerrainProvider"
import { GroundClamp, Jump, MoveByVel } from "./classes/Player/PlayerPhysics"
import { WorldPositionConstraint } from "./classes/ParentConstraints/WorldPositionConstraint"
import { MouseLockProvider } from "./classes/Player/MouseLock"
import { WebGPUPostProcessingProvider } from "./classes/PostProcessing/PostProcessingContext"

import { Leva } from 'leva';
import { SnowSpritesUI } from "./classes/Terrain/SnowSprites"
import { LoadGltfGeo, TerrainFadeMaterial, TerrainPivotMaterial, TerrainScatter } from "./classes/Terrain/TerrainScatter"
import { PlayerProvider } from "./classes/Player/PlayerContext"
import { TerrainScatterInteractive } from "./classes/Terrain/TerrainScatterInteractive"
import { RaycastOnClick } from "./classes/Player/RaycastOnClick"
import { PP_FogPass } from "./classes/PostProcessing/Effects/PP_FogPass"
import { PP_PixelHighlights } from "./classes/PostProcessing/Effects/PP_PixelatedPass"
import { CameraUniformsProvider } from "./classes/PostProcessing/cameraUniformsContext"
import { ECS_Test } from "./classes/Terrain/ECS_Test"
import { ECS_VertexPulling } from "./classes/Terrain/ECS_VertexPulling"
import { ECS_NBRGrid } from "./classes/Terrain/ECS/ECS_NBRGrid"

extend({ MeshStandardNodeMaterial })



const App = () => {
  return (
    <UIScreenProvider>
      <div
        style={{
          overflow: "hidden",
          position: "relative",
          background: "black",
        }}
      >

        <div id="CanvasParent"
          style={{
            position: "fixed",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100vw",
            height: "100vh",
            background: "black",
            overflow: "hidden",
            inset: 0
          }}>

          <div id="Canvas3D"
            style={{
              width: "100%",
              height: "auto",
              aspectRatio: "235 / 100",
            }}>
            {0 && <Leva collapsed />}

            <Canvas
              camera={{ fov: 50, aspect: 2.35, position: [0, 0, 0] }}
              //gl={{ antialias: false }}

              gl={async (props) => {
                const renderer = new THREE.WebGPURenderer({
                  ...props,
                  antialias: false,
                } as any)

                await renderer.init()
                return renderer
              }}
              style={{ background: "black" }}
            >
              <Stats />

              <Suspense>
                <PlayerProvider>

                  <CameraUniformsProvider>
                    <WebGPUPostProcessingProvider >
                      {0 && <PP_PixelHighlights />}
                      <PP_FogPass density={0.25 * 0.01} heightFalloff={0.01} />
                    </WebGPUPostProcessingProvider>
                  </CameraUniformsProvider>

                  <Physics>

                    <Pixelated resolution={128} enabled={false} />

                    <group name="Lights">
                      <ambientLight intensity={0.2} />
                      <pointLight intensity={0.00} position={[100, 100, 100]} />
                      <directionalLight position={[10, 5, 0]} intensity={0.6} castShadow />
                    </group>

                    <MouseLockProvider>
                      <KeyboardControls
                        map={[
                          { name: "forward", keys: ["ArrowUp", "w", "W", "Ц", "ц"] },
                          { name: "backward", keys: ["ArrowDown", "s", "S", "Ы", "ы"] },
                          { name: "left", keys: ["ArrowLeft", "a", "A", "Ф", "ф"] },
                          { name: "right", keys: ["ArrowRight", "d", "D", "В", "в"] },
                          { name: "jump", keys: ["Space"] },
                          { name: "shift", keys: ["Shift"] },
                        ]}
                      >
                        <TerrainProvider textureUrl="textures/HFs/height.png">
                          <Player >
                            <WorldPositionConstraint>
                              {0 && <TerrainPlane />}
                            </WorldPositionConstraint>

                            {1 && <MoveByVel />}
                            <Jump />
                            <GroundClamp />

                          </Player>

                          {1 && <TerrainScatterInteractive
                            name="Boxes"
                            gridSize={30}
                            spacing={1.1}
                            visible={false}
                          />}

                          {1 && <TerrainScatter
                            name="Trees"
                            gridSize={10}
                            scale={5}
                            spacing={10}
                            rotation_random={1}
                            offset_random={1}
                            visible={false}
                          >
                            <TerrainFadeMaterial />
                            <LoadGltfGeo url="models/Tree.glb" />
                          </TerrainScatter>
                          }

                          {0 && <TerrainScatter
                            name="Grass"
                            gridSize={30}
                            scale={4}
                            spacing={2}
                            rotation_random={1}
                            offset_random={0}
                            scale_random={0.5}
                          >
                            {0 && <TerrainFadeMaterial />}
                            <TerrainPivotMaterial />
                            <LoadGltfGeo url="models/Grass.glb" />
                          </TerrainScatter>
                          }

                          {0 && <ECS_Test name="ECS_Test"
                            spacing={2} />}
                          {1 && <ECS_NBRGrid name="Veretex Pulling" spacing={0.5} gridSize={25}/>}
                          {0 && <ECS_VertexPulling name="Veretex Pulling" spacing={2} />}


                        </TerrainProvider>

                      </KeyboardControls>
                    </MouseLockProvider>

                    {0 && <TaskSelectorPawn />}
                    {0 && <AuroraBackground />}
                    {false && <TestSDF />}
                    {1 && <SimpleBackground />}


                    <SnowSpritesUI active={true} showControls={true} />

                    {false && <TestTslShader />}

                    {0 && <RaycastOnClick />}

                    {/**
                  <RigidBody type="fixed">
                    <Box position={[0,0,0]} args = {[10,1,10]}>
                      <meshStandardMaterial color = "springgreen" />
                    </Box>
                  </RigidBody>
                  */}


                  </Physics>
                </PlayerProvider>
              </Suspense>
            </Canvas>
          </div>
        </div>


      </div >
    </UIScreenProvider>
  )
}


export default App


