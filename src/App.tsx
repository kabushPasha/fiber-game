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
  const [score, setScore] = useState<number | null>(null)

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
                  console.log("TASK END:",e);
                  saveTaskScore(activeTask.task_name, e.finalScore);
                  setScore(null);
                }}
                onScoreChange={(e) => {
                  setScore(e.score);
                }}
              />
            )}

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
        <CrosshairDot size={6} color="white" opacity={0.5} />

        {/**Task Selector */}
        {!activeTask && (<TaskSelector tasks={tasks} onSelect={(task) => setActiveTask(task)} />)}

        {/**Score Display */}
        {activeTask && score !== null &&  (
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              padding: "10px 16px",
              background: "rgba(0,0,0,0.6)",
              color: "white",
              fontSize: "18px",
              fontFamily: "monospace",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.2)",
              pointerEvents: "none",
            }}
          >
            Score: {score.toFixed(2)}
          </div>
        )}

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
