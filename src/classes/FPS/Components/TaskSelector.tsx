import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AllTasks, type TaskDefinition } from "./Task";
import { useUI } from "../../../components/UIScreenContext";
import { TaskSelector } from "../UI/TaskSelector";




export function TaskSelectorPawn() {
    const { mount } = useUI()
    const ref = useRef<THREE.Object3D>(null!);

    const [activeTask, setActiveTask] = useState<TaskDefinition | null>(null)


    useEffect(() => {
        const unmount = mount(() =>
            <>
                {!activeTask &&
                    <TaskSelector tasks={AllTasks} onSelect={(task) => {
                        setActiveTask(task);
                    }} />}
            </>
        )
        return unmount
    }, [activeTask])


    return <group ref={ref} name="TaskSelector">
        {activeTask && (
            <activeTask.component
                onTaskEnd={(e) => {
                    setActiveTask(null)
                    console.log("TASK END:", e);
                    saveTaskScore(activeTask.task_name, e.finalScore);
                }}
            />
        )}
    </group>;

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