import { AddCallbackToParentEvent, AddHitCallback, AddMountCallback } from "./AddCallbackToParentEvent"
import { SimpleTarget } from "../../SimpleTarget"
import { Timer } from "./Timer"
import { AddPositionProvider, useParentPositionProvider } from "./AddPositionProvider"
import { FinishTaskOnMaxScore, ScoreComponent } from "./ScoreComponent"
import * as THREE from "three";
import { playSound } from "../Classes/sounds"


interface TaskProps {
    onTaskEnd?: () => void
}



export const Task = ({ onTaskEnd }: TaskProps) => {

    return (
        <>
            <group name="Task">
                <Timer showUI={true} />
                <AddPositionProvider />
                <ScoreComponent />
                <FinishTaskOnMaxScore onFinished={ () => {onTaskEnd?.();}} maxScore={5}/>

                {Array.from({ length: 3 }).map((_, i) => (
                    <SimpleTarget key={i}>
                        <AddHitCallback   callback={(e) => { e.source.parent.dispatchEvent({ type: "add_score", source: e.source, score: 1 }); }} />
                        <AddHitCallback   callback={(e) => { useParentPositionProvider(e.source) }} />
                        <AddHitCallback   callback={(e) => { playSound("sfx/bullet-metal-hit.mp3", 0.1) }} />
                        <AddMountCallback callback={(e) => { useParentPositionProvider(e.source); }} />
                    </SimpleTarget>
                ))}
            </group>
        </>
    )
}
