import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AddCallbackToParentEvent } from "./AddCallbackToParentEvent";

interface ScoreComponentProps {
    onScoreChange?: (source: THREE.Object3D) => void; // optional callback for parent
}

export const ScoreComponent = ({ onScoreChange }: ScoreComponentProps) => {
    const ref = useRef<THREE.Object3D>(null!);

    useEffect(() => {
        const parent = ref.current?.parent as THREE.Group;
        parent.userData.score = 0;
        if (!parent) return;

        const handleScore = (e: any) => {
            parent.userData.score += e.score;
            onScoreChange?.(parent);
            parent.dispatchEvent({ type: "score_change", source: parent });
        };

        parent.addEventListener("add_score", handleScore);

        return () => {
            parent.removeEventListener("add_score", handleScore);
        };
    }, [onScoreChange]);

    return <group ref={ref} />;
};


export function AddScoreChangeCallback({ callback }: { callback: (e: any) => void }) {
    return <AddCallbackToParentEvent event="score_change" callback={callback} />
}

export function FinishTaskOnMaxScore({ onFinished, maxScore = 5 }: { onFinished: (e:any) => void, maxScore: number }) {
    return <AddScoreChangeCallback callback={
        (e) => {
            if (e.source.userData.score > maxScore) {
                console.log("Task finished!", e.source.userData.time);
                onFinished(e);
            }
        }}
    />
}


