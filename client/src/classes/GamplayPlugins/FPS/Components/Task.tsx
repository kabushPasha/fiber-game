import {  AddHitCallback, AddHoverCallback, AddMountCallback, AddTickCallback, TickComponent } from "./AddCallbackToParentEvent"
import { SimpleTarget } from "../SimpleTarget"
import { AddPositionProvider, GridPositionProviderComponent, useParentPositionProvider } from "./AddPositionProvider"
import { AddScoreChangeCallback, ScoreComponent } from "./ScoreComponent"
import * as THREE from "three";
import { playSound } from "../Classes/sounds"
import { RandomReverseVelocity } from "./TragetComponents/RandomReverseVelocity"
import { ClampToBbox } from "./TragetComponents/ClampToBbox"
import { UseNoisePosition } from "./TragetComponents/UseNoisePosition"
import React, { useRef, useState } from "react"
//import { useUI } from "../../../components/UIScreenContext"
import { UIComponent, useThreeEvent } from "../UI/UIComponent"
import type { GameObject } from "../../../GameObjectEventMap";

export interface TaskProps {
    onTaskEnd?: (e: any) => void,
    onScoreChange?: (e: any) => void,
    children?: React.ReactNode
    maxScore?: number
}

export type TaskDefinition = {
    task_name: string
    component: React.FC<TaskProps>
}


export const TaskUI = {
    TimerUI: ({ obj }: { obj?: THREE.Object3D }) => {
        if (!obj) return;
        const [time, setTime] = useState(0)

        useThreeEvent(obj, "tick", (e: any) => {
            setTime(e.source.userData.time)
        })

        return (
            <div
                style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    padding: "10px 16px",
                    background: "rgba(0,0,0,0.6)",
                    color: "white",
                    fontSize: "18px",
                    fontFamily: "monospace",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    pointerEvents: "none",
                    width: "200px",
                }}
            >
                Score: {time}
            </div>
        )
    },

    ScoreUI: ({ obj }: { obj?: THREE.Object3D }) => {
        if (!obj) return;
        const [score, setScore] = useState(0)

        useThreeEvent(obj, "score_change", (e: any) => {
            setScore(e.source.userData.score)
        })

        return (
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
        )
    },
}



export const OneMinuteTask = (taskProps: TaskProps) => {
    const timeRef = useRef(0);
    const finishedRef = useRef(false);
    const max_time = 5;

    return (
        <>
            <TickComponent />
            <UIComponent Component={TaskUI.TimerUI} />
            <UIComponent Component={TaskUI.ScoreUI} />

            <AddTickCallback callback={(e) => {
                if (finishedRef.current) return;
                timeRef.current += e.delta;
                e.source.userData.time = timeRef.current + e.delta;

                if (timeRef.current > max_time) {
                    finishedRef.current = true;
                    (e as any).finalScore = e.source.userData.score;
                    taskProps.onTaskEnd?.(e);
                }
            }} />

            <ScoreComponent />
            <AddScoreChangeCallback callback={(e) => {
                e.score = e.source.userData.score;
                taskProps.onScoreChange?.(e);
            }} />
        </>
    )
}



export const Task = (taskProps: TaskProps) => {
    return (
        <>
            <group name="Task">
                <OneMinuteTask {...taskProps} />
                <AddPositionProvider />

                {Array.from({ length: 3 }).map((_, i) => (
                    <SimpleTarget key={i}>
                        <AddHitCallback callback={(e) => { (e.source.parent! as GameObject).dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback callback={() => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
                        <AddMountCallback callback={(e) => { useParentPositionProvider(e.source); }} />

                        <boxGeometry args={[1, 1, 1]} />
                    </SimpleTarget>
                ))}

                {taskProps.children}
            </group>
        </>
    )
}

export const GridTask = (taskProps: TaskProps) => {
    return (
        <>
            <group name="Task">
                <OneMinuteTask {...taskProps} maxScore={30} />
                <GridPositionProviderComponent />

                {Array.from({ length: 3 }).map((_, i) => (
                    <SimpleTarget key={i}>
                        <AddHitCallback callback={(e) => { (e.source.parent! as GameObject).dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback callback={() => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
                        <AddMountCallback callback={(e) => { useParentPositionProvider(e.source); }} />

                        <boxGeometry args={[1, 1, 1]} />
                    </SimpleTarget>
                ))}

                {taskProps.children}
            </group>
        </>
    )
}

export const MoveByVel = () => {
    return <AddTickCallback callback={(e) => { e.source.position.add((e.source.userData.v as THREE.Vector3).clone().multiplyScalar(e.delta)); }} />
}


export const TrackingTask = (taskProps: TaskProps) => {
    return (
        <>
            <group name="TrackingTask">
                <OneMinuteTask {...taskProps} maxScore={5} />


                <SimpleTarget>
                    <AddMountCallback callback={(e) => { e.source.userData.v = new THREE.Vector3(1, 0, 0); }} />


                    <AddHoverCallback callback={(e) => { (e.source.parent! as GameObject).dispatchEvent({ type: "add_score", source: e.source, score: e.delta }); }} />
                    <AddHoverCallback callback={() => { playSound("sfx/bullet-metal-hit.mp3", 0.002) }} />
                    <MoveByVel />
                    <RandomReverseVelocity minDelay={4} maxDelay={6} />
                    <ClampToBbox size={new THREE.Vector3(6, 2, 2)} />

                    <capsuleGeometry args={[0.1, 1.5]} />
                </SimpleTarget>


                {taskProps.children}
            </group>
        </>
    )
}


export const SmoothTrack2d = (taskProps: TaskProps) => {
    return (
        <>
            <group name="SmoothTrack2d">
                <OneMinuteTask {...taskProps} maxScore={5} />

                <SimpleTarget>
                    <AddHoverCallback callback={(e) => { (e.source.parent! as GameObject).dispatchEvent({ type: "add_score", source: e.source, score: e.delta }); }} />
                    <AddHoverCallback callback={() => { playSound("sfx/bullet-metal-hit.mp3", 0.002) }} />

                    <UseNoisePosition
                        frequency={0.5}
                        amplitude={new THREE.Vector3(4, 4, 0.1)}
                        offset={new THREE.Vector3(0, 0.5, 0)}
                    />

                    <capsuleGeometry args={[0.1, 0.1]} />
                </SimpleTarget>

                {taskProps.children}
            </group>
        </>
    )
}




export const AllTasks: TaskDefinition[] = [
    { task_name: "BasicTask", component: Task },
    { task_name: "GridTask", component: GridTask },
    { task_name: "TrackingTask", component: TrackingTask },
    { task_name: "SmoothTrack2d", component: SmoothTrack2d },
    { task_name: "OneMinuteTask", component: OneMinuteTask }
]