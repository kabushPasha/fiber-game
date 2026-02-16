import { AddCallbackToParentEvent, AddHitCallback, AddHoverCallback, AddMountCallback, AddTickCallback, type TargetEvent } from "./AddCallbackToParentEvent"
import { SimpleTarget } from "../../SimpleTarget"
import { Timer } from "./Timer"
import { AddPositionProvider, GridPositionProviderComponent, useParentPositionProvider } from "./AddPositionProvider"
import { AddScoreChangeCallback, FinishTaskOnMaxScore, ScoreComponent } from "./ScoreComponent"
import * as THREE from "three";
import { playSound } from "../Classes/sounds"
import { RandomReverseVelocity } from "./TragetComponents/RandomReverseVelocity"
import { ClampToBbox } from "./TragetComponents/ClampToBbox"
import { UseNoisePosition } from "./TragetComponents/UseNoisePosition"

export interface TaskProps {
    onTaskEnd?: (e:any) => void,
    children?: React.ReactNode
    maxScore?: number
}

export type TaskDefinition = {
    task_name: string
    component: React.FC<TaskProps>
}

export const TimedTaskComponents = (taskProps: TaskProps) => {
    return (<>
        <Timer showUI={true} />
        <ScoreComponent />
        <FinishTaskOnMaxScore onFinished={(e) => { taskProps.onTaskEnd?.(e); }} maxScore={taskProps.maxScore ?? 5} />
    </>)
}



export const Task = (taskProps: TaskProps) => {
    return (
        <>
            <group name="Task">
                <TimedTaskComponents {...taskProps} />
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
                <TimedTaskComponents {...taskProps} maxScore={30}/>
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
                <TimedTaskComponents {...taskProps} maxScore={5} />


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
                <TimedTaskComponents {...taskProps} maxScore={5} />

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
]