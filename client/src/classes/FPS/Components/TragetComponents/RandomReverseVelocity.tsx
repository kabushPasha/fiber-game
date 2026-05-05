import React, { useRef } from "react";
import * as THREE from "three";
import { AddTickCallback } from "../AddCallbackToParentEvent";

type RandomReverseVelocityProps = {
    minDelay?: number;
    maxDelay?: number;
};

export const RandomReverseVelocity: React.FC<RandomReverseVelocityProps> = ({
    minDelay = 0.1,
    maxDelay = 2.0
}) => {

    // timers stored in refs so they persist across frames
    const timerRef = useRef(0);
    const nextFlipRef = useRef(minDelay + Math.random() * (maxDelay - minDelay));

    return (
        <AddTickCallback callback={(e) => {
            const mesh = e.source;
            let v = mesh.userData.v as THREE.Vector3 | undefined;
            if (!v) {
                v = new THREE.Vector3(1, 0, 0);
                mesh.userData.v = v;
            }

            // add position delta
            mesh.position.add(v.clone().multiplyScalar(e.delta));

            // update timer
            timerRef.current += e.delta;
            if (timerRef.current >= nextFlipRef.current) {
                // flip velocity
                v.multiplyScalar(-1);

                // reset timer and pick next flip delay
                timerRef.current = 0;
                nextFlipRef.current = minDelay + Math.random() * (maxDelay - minDelay);
            }
        }} />
    );
};
