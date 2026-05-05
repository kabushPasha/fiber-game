import React, { useRef } from "react";
import * as THREE from "three";

import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js"; // make sure to import
import { AddTickCallback } from "../AddCallbackToParentEvent";

type UseNoisePositionProps = {
    frequency?: number;
    amplitude?: THREE.Vector3;
    offset?: THREE.Vector3;
};

export const UseNoisePosition: React.FC<UseNoisePositionProps> = ({
    frequency = 1,
    amplitude = new THREE.Vector3(1, 1, 1),
    offset = new THREE.Vector3(0, 0, 0),
}) => {
    const noiseRef = useRef(new ImprovedNoise());
    const timeRef = useRef(0);

    return (
        <AddTickCallback callback={(e) => {
            const mesh = e.source;

            const dt = e.delta ?? 0;
            timeRef.current += dt;

            const t = timeRef.current * frequency;

            // per-axis noise
            const x = noiseRef.current.noise(t, 12.3, 45.6);
            const y = noiseRef.current.noise(67.8, t, 90.1);
            const z = noiseRef.current.noise(23.4, 56.7, t);

            mesh.position.set(
                offset.x + x * amplitude.x,
                offset.y + y * amplitude.y,
                offset.z + z * amplitude.z
            );
        }} />
    );
};
