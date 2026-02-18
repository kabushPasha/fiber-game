import { AddCallbackToParentEvent, AddHitCallback, AddHoverCallback, AddMountCallback, AddTickCallback, TickComponent, type TargetEvent } from "./AddCallbackToParentEvent"
import { SimpleTarget } from "../../SimpleTarget"
import { Timer } from "./Timer"
import { AddPositionProvider, GridPositionProviderComponent, useParentPositionProvider } from "./AddPositionProvider"
import { AddScoreChangeCallback, FinishTaskOnMaxScore, ScoreComponent } from "./ScoreComponent"
import * as THREE from "three";
import { playSound } from "../Classes/sounds"
import { RandomReverseVelocity } from "./TragetComponents/RandomReverseVelocity"
import { ClampToBbox } from "./TragetComponents/ClampToBbox"
import { UseNoisePosition } from "./TragetComponents/UseNoisePosition"
import { useRef, useState } from "react"

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


export const OneMinuteTask = (taskProps: TaskProps) => {
    const timeRef = useRef(0);
    const finishedRef = useRef(false);
    const max_time = 5;

    return (
        <>
            <TickComponent />
            <AddTickCallback callback={(e) => {
                if (finishedRef.current) return;

                timeRef.current += e.delta;

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
                        <AddHitCallback callback={(e) => { e.source.parent.dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
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
                        <AddHitCallback callback={(e) => { e.source.parent.dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
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


                    <AddHoverCallback callback={(e) => { e.source.parent!.dispatchEvent({ type: "add_score", source: e.source, score: e.delta }); }} />
                    <AddHoverCallback callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.002) }} />
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
                    <AddHoverCallback callback={(e) => { e.source.parent!.dispatchEvent({ type: "add_score", source: e.source, score: e.delta }); }} />
                    <AddHoverCallback callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.002) }} />

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