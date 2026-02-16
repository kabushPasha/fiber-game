import { Canvas } from "@react-three/fiber"
import "./App.css"
import { useRef, useState } from "react"
import * as THREE from "three"

import {
  KeyboardControls,
  Environment,
  Html
} from "@react-three/drei"

import { Player } from "./classes/Player"
import { Pixelated } from "./components/Pixelated"
import { CrosshairDot } from "./components/CrosshairDot"
import { GridTask, Task, type TaskDefinition, type TaskProps, AllTasks as tasks } from "./classes/FPS/Components/Task"
import { TaskSelector } from "./classes/FPS/UI/TaskSelector"


const App = () => {
  const [activeTask, setActiveTask] = useState<TaskDefinition | null>(null)



  const buttonStyle: React.CSSProperties = {
    padding: "10px 20px",
    fontSize: "16px",
    cursor: "pointer",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    width: "200px",
    height: "60px",
  }


  return (
    <div
      style={{
        overflow: "hidden",
        position: "relative",
        background: "black",
      }}
    >

      <div id="CanvasParent"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          background: "black",
          overflow: "hidden"
        }}>

        <div id="Canvas3D"
          style={{
            width: "100%",
            height: "auto",
            aspectRatio: "235 / 100",
          }}>

          <Canvas
            camera={{ fov: 50, aspect: 2.35 }}
            gl={{ antialias: false }}
            style={{ background: "black" }}
          >
            <Pixelated resolution={128} />
            <group name="Lights">
              <Environment
                files="textures/hdri/clouds.jpg"
                background
                environmentIntensity={1}
              />
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

            {activeTask && (
              <activeTask.component
                onTaskEnd={(e) => {
                  setActiveTask(null)
                  saveTaskScore(activeTask.task_name, e.source.userData.time);
                }}
              />
            )}

          </Canvas>
        </div>
      </div>

      <div id="UI">
        <CrosshairDot size={6} color="white" opacity={0.5} />

        {!activeTask && (
          <TaskSelector
            tasks={tasks}
            onSelect={(task) => setActiveTask(task)}
          />)}


      </div>
    </div >
  )
}

export function saveTaskScore(taskName: string, score: number) {
  const allScores = JSON.parse(localStorage.getItem("taskScores") || "{}");
  if (!allScores[taskName]) allScores[taskName] = [];
  allScores[taskName].push({
    score,
    timestamp: Date.now(),
  });
  localStorage.setItem("taskScores", JSON.stringify(allScores));
}


export default App
