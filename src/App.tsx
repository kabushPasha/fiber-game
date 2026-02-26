import { Canvas } from "@react-three/fiber"
import "./App.css"
import { useRef, useState } from "react"
import * as THREE from "three/webgpu"

import { KeyboardControls, Environment, Html } from "@react-three/drei"
import { Player } from "./classes/Player"
import { Pixelated } from "./components/Pixelated"
import { CrosshairDot } from "./components/CrosshairDot"
import { GridTask, Task, type TaskDefinition, type TaskProps, AllTasks as tasks } from "./classes/FPS/Components/Task"
import { TaskSelector } from "./classes/FPS/UI/TaskSelector"
import { UIScreenProvider } from "./components/UIScreenContext"
import { TaskSelectorPawn } from "./classes/FPS/Components/TaskSelector"
import { AuroraBackground } from "./classes/shaders/Aurora"
import { SdfBackground, TestSDF } from "./classes/shaders/Raymarcher"


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
              camera={{ fov: 50, aspect: 2.35, position: [0, 1.75, 3] }}
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

              <Pixelated resolution={128} />


              <group name="Lights">
                {/** 
                <Environment
                  files="textures/hdri/clouds.jpg"
                  //background
                  environmentIntensity={1}
                />
                */}
                <ambientLight intensity={0.3} />
                <pointLight intensity={0.8} position={[100, 100, 100]} />
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
                <Player />
              </KeyboardControls>

              
              
{/*               <TaskSelectorPawn/> 
 */}

              <AuroraBackground />
              <TestSDF />


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


