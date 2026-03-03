import { Canvas } from "@react-three/fiber"
import "./App.css"
import * as THREE from "three/webgpu"

import { KeyboardControls, Box } from "@react-three/drei"
import { Player } from "./classes/Player"
import { Pixelated } from "./components/Pixelated"
import { UIScreenProvider } from "./components/UIScreenContext"
import { TaskSelectorPawn } from "./classes/FPS/Components/TaskSelector"
import { AuroraBackground, SimpleBackground } from "./classes/shaders/Aurora"
import { TestSDF } from "./classes/shaders/Raymarcher"



import { extend } from "@react-three/fiber"
import { MeshStandardNodeMaterial, } from "three/webgpu"
import { TestTslShader } from "./classes/shaders/SimpleTslGrid"
import { Terrain, TerrainPlane } from "./classes/Terrain/Terrain"


import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { Suspense } from "react"
import { TerrainSampler } from "./classes/TerrainSampler"
import { TerrainProvider } from "./classes/Terrain/TerrainProvider"

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

            <Canvas
              camera={{ fov: 50, aspect: 2.35, position: [0, 1.75, 0] }}
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
                <Physics>

                  {0 && <Pixelated resolution={128} />}

                  <group name="Lights">
                    <ambientLight intensity={0.2} />
                    <pointLight intensity={0.00} position={[100, 100, 100]} />
                    <directionalLight position={[10, 5, 0]} intensity={0.6} />
                  </group>


                  <KeyboardControls
                    map={[
                      { name: "forward", keys: ["ArrowUp", "w", "W"] },
                      { name: "backward", keys: ["ArrowDown", "s", "S"] },
                      { name: "left", keys: ["ArrowLeft", "a", "A"] },
                      { name: "right", keys: ["ArrowRight", "d", "D"] },
                      { name: "jump", keys: ["Space"] },
                    ]}
                  >
                    <TerrainProvider textureUrl="/textures/HFs/height.png">
                      <Player >
                        <TerrainSampler />
                        <TerrainPlane />
                      </Player>
                      {0 && <Terrain />}
                    </TerrainProvider>




                  </KeyboardControls>

                  {0 && <TaskSelectorPawn />}

                  <AuroraBackground />
                  <TestSDF />
                  <SimpleBackground />


                  {false && <TestTslShader />}


                  {/**
                  <RigidBody type="fixed">
                    <Box position={[0,0,0]} args = {[10,1,10]}>
                      <meshStandardMaterial color = "springgreen" />
                    </Box>
                  </RigidBody>
                  */}





                </Physics>
              </Suspense>
            </Canvas>
          </div>
        </div>

        <div id="UI" style={{
          position: "fixed",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          inset: 0
        }}>

        </div>
      </div >
    </UIScreenProvider>
  )
}


export default App


