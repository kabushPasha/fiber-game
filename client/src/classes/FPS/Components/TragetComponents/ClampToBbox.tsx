import React from "react";
import * as THREE from "three";
import { AddTickCallback } from "../AddCallbackToParentEvent";

type ClampToBboxProps = {
    size: THREE.Vector3;
};

export const ClampToBbox: React.FC<ClampToBboxProps> = ({ size }) => {
    const halfSize = size.clone().multiplyScalar(0.5);

    return (
        <AddTickCallback callback={(e) => {
            const mesh = e.source;

            // initialize velocity if missing
            let v = mesh.userData.v as THREE.Vector3 | undefined;
            if (!v) {
                v = new THREE.Vector3(1, 0, 0); // default velocity
                mesh.userData.v = v;
            }

            // update position
            mesh.position.add(v.clone().multiplyScalar(e.delta));

            // clamp each axis
            (['x', 'y', 'z'] as const).forEach(axis => {
                if (mesh.position[axis] < -halfSize[axis]) {
                    mesh.position[axis] = -halfSize[axis];
                    v[axis] *= -1; // reverse velocity
                }
                if (mesh.position[axis] > halfSize[axis]) {
                    mesh.position[axis] = halfSize[axis];
                    v[axis] *= -1; // reverse velocity
                }
            });
        }} />
    );
};
