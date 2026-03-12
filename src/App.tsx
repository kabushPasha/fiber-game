import { Canvas } from "@react-three/fiber"
import "./App.css"
import * as THREE from "three/webgpu"

import { KeyboardControls } from "@react-three/drei"
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
import { Grass } from "./classes/Terrain/Grass"
import { GroundClamp, Jump, MoveByVel } from "./classes/Player/PlayerPhysics"
import { WorldPositionConstraint } from "./classes/ParentConstraints/WorldPositionConstraint"
import { MouseLockProvider } from "./classes/Player/MouseLock"
import { PP_FogPass, WebGPUPostProcessingProvider } from "./classes/PostProcessing/PostProcessingContext"

import { folder, Leva, useControls } from 'leva';
import { SnowSprites, SnowSpritesUI } from "./classes/Terrain/SnowSprites"
import { TerrainScatterUI } from "./classes/Terrain/TerrainScatter"
import { TerrainScatterCompute } from "./classes/Terrain/TerrainScatterCompute"
import { PlayerProvider } from "./classes/Player/PlayerContext"

extend({ MeshStandardNodeMaterial })



const App = () => {

  const settings = useControls("PostProcessing",
    {
      "Fog": folder({
        add_fog: true,
        density: {
          value: 0.25,
          min: 0.01,
          max: 5,
          step: 0.01,
        },
        heightFalloff: {
          value: 0.01,
          min: 0.001,
          max: 0.1,
          step: 0.001,
        }
      })
    }
  )

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
            <Leva collapsed />

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


              <Suspense>
                <PlayerProvider>

                  <WebGPUPostProcessingProvider >
                    {settings.add_fog && <PP_FogPass density={settings.density * 0.01} heightFalloff={settings.heightFalloff} />}
                  </WebGPUPostProcessingProvider>

                  <Physics>

                    {0 && <Pixelated resolution={256} />}

                    <group name="Lights">
                      <ambientLight intensity={0.2} />
                      <pointLight intensity={0.00} position={[100, 100, 100]} />
                      <directionalLight position={[10, 5, 0]} intensity={0.6} />
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
                              {1 && <TerrainPlane />}
                              {0 && <Grass />}
                              {1  && <TerrainScatterUI />}
                            </WorldPositionConstraint>

                            {1 && <MoveByVel />}
                            <Jump />
                            <GroundClamp />

                            

                          </Player>

                          {0 && <TerrainScatterCompute />}

                        </TerrainProvider>

                      </KeyboardControls>
                    </MouseLockProvider>

                    {0 && <TaskSelectorPawn />}
                    {0 && <AuroraBackground />}
                    {false && <TestSDF />}
                    {1 && <SimpleBackground />}


                    <SnowSpritesUI active={true} showControls={true} />

                    {false && <TestTslShader />}


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


