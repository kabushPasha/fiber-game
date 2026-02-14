import { AddCallbackToParentEvent, AddHitCallback, AddMountCallback } from "./AddCallbackToParentEvent"
import { SimpleTarget } from "../../SimpleTarget"
import { Timer } from "./Timer"
import { AddPositionProvider, GridPositionProviderComponent, useParentPositionProvider } from "./AddPositionProvider"
import { FinishTaskOnMaxScore, ScoreComponent } from "./ScoreComponent"
import * as THREE from "three";
import { playSound } from "../Classes/sounds"
import { GridPositionProvider } from "../Classes/GridPositionProvider"


export interface TaskProps {
    onTaskEnd?: () => void
}

export type TaskDefinition = {
    task_name: string
    component: React.FC<TaskProps>
}


export const Task = ({ onTaskEnd }: TaskProps) => {
    return (
        <>
            <group name="Task">
                <Timer showUI={true} />
                <AddPositionProvider />
                <ScoreComponent />
                <FinishTaskOnMaxScore onFinished={() => { onTaskEnd?.(); }} maxScore={5} />

                {Array.from({ length: 3 }).map((_, i) => (
                    <SimpleTarget key={i}>
                        <AddHitCallback callback={(e) => { e.source.parent.dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
                        <AddMountCallback callback={(e) => { useParentPositionProvider(e.source); }} />
                    </SimpleTarget>
                ))}
            </group>
        </>
    )
}

export const GridTask = ({ onTaskEnd }: TaskProps) => {
    return (
        <>
            <group name="Task">
                <Timer showUI={true} />
                <GridPositionProviderComponent />
                <ScoreComponent />
                <FinishTaskOnMaxScore onFinished={() => { onTaskEnd?.(); }} maxScore={5} />

                {Array.from({ length: 3 }).map((_, i) => (
                    <SimpleTarget key={i}>
                        <AddHitCallback callback={(e) => { e.source.parent.dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
                        <AddMountCallback callback={(e) => { useParentPositionProvider(e.source); }} />
                    </SimpleTarget>
                ))}
            </group>
        </>
    )
}

export const AllTasks: TaskDefinition[] = [
    { task_name: "Basic Task", component: Task },
    { task_name: "Grid Task", component: GridTask },
]