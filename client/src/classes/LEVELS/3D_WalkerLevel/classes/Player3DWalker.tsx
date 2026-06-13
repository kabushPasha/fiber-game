import {
    CapsuleCollider,
    RapierRigidBody,
    RigidBody,
    useRapier,
} from "@react-three/rapier";
import * as THREE from "three/webgpu";
import { useRef } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Walker3d_Camera } from "./Camera3dWalker";


export function Walker3D_Player() {
    const body = useRef<RapierRigidBody>(null);

    const { world } = useRapier();
    const [, get] = useKeyboardControls();


    useFrame(({ camera, scene }, delta) => {
        const rb = body.current;
        if (!rb) return;

        const { forward, backward, left, right, jump } = get();

        const up = new THREE.Vector3(world.gravity.x, world.gravity.y, world.gravity.z).negate().normalize()

        // ----------------------------
        // MOVEMENT (camera-relative)
        // ----------------------------
        const cameraForward = new THREE.Vector3();
        camera.getWorldDirection(cameraForward);

        const cam_quat = new THREE.Quaternion();
        camera.getWorldQuaternion(cam_quat)
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam_quat);

        cameraForward.sub(up.clone().multiplyScalar(cameraForward.dot(up))).normalize();
        const cameraRight = new THREE.Vector3().crossVectors(cameraForward, up).normalize();


        const moveDir = new THREE.Vector3();

        if (forward) moveDir.add(cameraForward);
        if (backward) moveDir.sub(cameraForward);
        if (right) moveDir.add(cameraRight);
        if (left) moveDir.sub(cameraRight);

        const moveSpeed = 8;

        const vel = rb.linvel();
        // extract vertical speed along gravity axis
        const verticalSpeed = vel.x * up.x + vel.y * up.y + vel.z * up.z;
        let newVel = new THREE.Vector3();

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();

            newVel
                .addScaledVector(moveDir, moveSpeed)
        }

        // preserve vertical motion
        newVel.addScaledVector(up, verticalSpeed);

        rb.setLinvel(newVel, true);

        // jump
        if (jump && Math.abs(verticalSpeed) < 0.05) {
            rb.applyImpulse(
                {
                    x: up.x * 4,
                    y: up.y * 4,
                    z: up.z * 4,
                },
                true
            );
        }


        // ----------------------------
        // RAYCAST
        // ----------------------------
        const pos = rb.translation();

        // RAPIER Raycaster
        /*
        const ray = new rapier.Ray(
            { x: pos.x, y: pos.y, z: pos.z },
            //world.gravity
            cameraUp.negate()
        );
        const hit = world.castRayAndGetNormal(
            ray,
            2,
            true,
            undefined,
            undefined,
            rb.collider(0)
        );
        if (hit) {
            world.gravity = { x: -hit.normal.x * 10, y: -hit.normal.y * 10, z: -hit.normal.z * 10 };
        }
        */

        // THREE Raycaster        
        const raycaster = new THREE.Raycaster();
        raycaster.layers.set(2);
        raycaster.set(new THREE.Vector3(pos.x, pos.y, pos.z), cameraUp.clone().negate());        
        const hits = raycaster.intersectObject(scene, true);
        if (hits.length > 0) {
            const hit = hits[0];
            //console.log(hit.distance);
            if (hit.face && hit.object instanceof THREE.Mesh && (hit.distance<2.0)) {
                const normal = hit.normal;
                if (normal)
                    world.gravity = { x: -normal.x * 10, y: -normal.y * 10, z: -normal.z * 10 };
            }
        }


        alignBodyToUp(rb, up, delta, 5);
        //alignBodyToUp2(rb, up, delta, 4, 15);        

    });

    return (
        <>
            {/* PLAYER */}
            <RigidBody
                ref={body}
                colliders={false}
                position={[0, 2, 0]}
                enabledRotations={[false, false, false]}
                gravityScale={1}
            >
                <CapsuleCollider args={[0.5, 0.4]} />

                {/* <mesh castShadow>
                    <capsuleGeometry args={[0.4, 1, 8, 16]} />
                    <meshStandardMaterial wireframe color="orange" />
                </mesh>*/}

                { 0 && <pointLight intensity={10} decay={1.5}/>}

                <Walker3d_Camera />
            </RigidBody>

        </>
    );
}



export function alignBodyToUp(
    rb: RapierRigidBody,
    up: THREE.Vector3,
    delta: number,
    alignSpeed = 8
) {
    const rot = rb.rotation();

    const currentQuat = new THREE.Quaternion(
        rot.x,
        rot.y,
        rot.z,
        rot.w
    );

    // Current forward direction
    const forward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(currentQuat);

    // Project forward onto plane perpendicular to UP
    forward.addScaledVector(
        up,
        -forward.dot(up)
    );

    // Handle degenerate case
    if (forward.lengthSq() < 0.0001) {
        forward.set(1, 0, 0);

        forward.addScaledVector(
            up,
            -forward.dot(up)
        );
    }

    forward.normalize();

    // Build orthonormal basis
    const right = new THREE.Vector3()
        .crossVectors(forward, up)
        .normalize();

    const correctedForward = new THREE.Vector3()
        .crossVectors(up, right)
        .normalize();

    const basis = new THREE.Matrix4();

    basis.makeBasis(
        right,
        up,
        correctedForward.clone().negate()
    );

    const targetQuat = new THREE.Quaternion()
        .setFromRotationMatrix(basis);

    currentQuat.slerp(
        targetQuat,
        1 - Math.exp(-alignSpeed * delta)
    );

    rb.setRotation(
        {
            x: currentQuat.x,
            y: currentQuat.y,
            z: currentQuat.z,
            w: currentQuat.w,
        },
        true
    );
}

export function alignBodyToUp2(
    rb: RapierRigidBody,
    up: THREE.Vector3,
    delta: number,
    minAlignSpeed = 2,
    maxAlignSpeed = 20
) {
    const rot = rb.rotation();

    const currentQuat = new THREE.Quaternion(
        rot.x,
        rot.y,
        rot.z,
        rot.w
    );

    // Current forward direction
    const forward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(currentQuat);

    // Project forward onto plane perpendicular to UP
    forward.addScaledVector(
        up,
        -forward.dot(up)
    );

    // Handle degenerate case
    if (forward.lengthSq() < 0.0001) {
        forward.set(1, 0, 0);

        forward.addScaledVector(
            up,
            -forward.dot(up)
        );
    }

    forward.normalize();

    // Build orthonormal basis
    const right = new THREE.Vector3()
        .crossVectors(forward, up)
        .normalize();

    const correctedForward = new THREE.Vector3()
        .crossVectors(up, right)
        .normalize();

    const basis = new THREE.Matrix4();

    basis.makeBasis(
        right,
        up,
        correctedForward.clone().negate()
    );

    const targetQuat = new THREE.Quaternion()
        .setFromRotationMatrix(basis);

    // Angular difference (0 -> PI radians)
    const angle = currentQuat.angleTo(targetQuat);

    // Normalize to 0..1
    const t = angle / Math.PI;

    // Quadratic response:
    // small errors = slow alignment
    // large errors = fast alignment
    const dynamicSpeed =
        minAlignSpeed +
        (maxAlignSpeed - minAlignSpeed) * t * t;

    currentQuat.slerp(
        targetQuat,
        1 - Math.exp(-dynamicSpeed * delta)
    );

    rb.setRotation(
        {
            x: currentQuat.x,
            y: currentQuat.y,
            z: currentQuat.z,
            w: currentQuat.w,
        },
        true
    );
}


export function getInterpolatedNormal(
    hit: THREE.Intersection,
    geometry: THREE.BufferGeometry
) {
    const normalAttr = geometry.attributes.normal;

    const face = hit.face!;
    const index = geometry.index!;

    const ia = index.getX(face.a);
    const ib = index.getX(face.b);
    const ic = index.getX(face.c);

    const na = new THREE.Vector3().fromBufferAttribute(normalAttr, ia);
    const nb = new THREE.Vector3().fromBufferAttribute(normalAttr, ib);
    const nc = new THREE.Vector3().fromBufferAttribute(normalAttr, ic);

    const bary = new THREE.Vector3();

    THREE.Triangle.getBarycoord(
        hit.point,
        new THREE.Vector3().fromBufferAttribute(
            geometry.attributes.position,
            ia
        ),
        new THREE.Vector3().fromBufferAttribute(
            geometry.attributes.position,
            ib
        ),
        new THREE.Vector3().fromBufferAttribute(
            geometry.attributes.position,
            ic
        ),
        bary
    );

    return new THREE.Vector3()
        .addScaledVector(na, bary.x)
        .addScaledVector(nb, bary.y)
        .addScaledVector(nc, bary.z)
        .normalize();
}

export function castAverageGroundNormal(
    world: any,
    rapier: any,
    center: THREE.Vector3,
    up: THREE.Vector3,
    rayRadius = 0.4,
    rayLength = 2,
    excludeCollider?: any
): THREE.Vector3 | null {

    // Build tangent basis around current up
    const tangentX = new THREE.Vector3(1, 0, 0);

    if (Math.abs(tangentX.dot(up)) > 0.9) {
        tangentX.set(0, 0, 1);
    }

    tangentX
        .addScaledVector(up, -tangentX.dot(up))
        .normalize();

    const tangentZ = new THREE.Vector3()
        .crossVectors(up, tangentX)
        .normalize();

    // Center + hexagon
    const offsets: THREE.Vector3[] = [
        new THREE.Vector3()
    ];

    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;

        offsets.push(
            tangentX.clone()
                .multiplyScalar(Math.cos(a) * rayRadius)
                .add(
                    tangentZ.clone()
                        .multiplyScalar(Math.sin(a) * rayRadius)
                )
        );
    }

    const down = up.clone().negate();

    const averageNormal = new THREE.Vector3();
    let totalWeight = 0;

    for (const offset of offsets) {

        /*
        const origin = center.clone().add(offset);

        const ray = new rapier.Ray(
            {
                x: origin.x,
                y: origin.y,
                z: origin.z,
            },
            {
                x: down.x,
                y: down.y,
                z: down.z,
            }
        );
        */
        const direction = offset
            .clone()
            .add(down)
            .normalize();

        const ray = new rapier.Ray(
            {
                x: center.x,
                y: center.y,
                z: center.z,
            },
            {
                x: direction.x,
                y: direction.y,
                z: direction.z,
            }
        );


        const hit = world.castRayAndGetNormal(
            ray,
            rayLength,
            true,
            undefined,
            undefined,
            excludeCollider
        );

        if (!hit) continue;

        const normal = new THREE.Vector3(
            hit.normal.x,
            hit.normal.y,
            hit.normal.z
        );

        // closer hits contribute more
        const weight = 1 / (0.01 + hit.timeOfImpact);

        averageNormal.addScaledVector(
            normal,
            weight
        );

        totalWeight += weight;
    }

    if (totalWeight === 0) {
        return null;
    }

    return averageNormal
        .divideScalar(totalWeight)
        .normalize();
}

export function castAverageGroundNormalCone(
    world: any,
    rapier: any,
    center: THREE.Vector3,
    up: THREE.Vector3,
    rayLength = 2,
    coneAngleDeg = 20,
    rayCount = 6,
    excludeCollider?: any
): THREE.Vector3 | null {

    const down = up.clone().negate();

    // Build tangent basis
    const tangentX = new THREE.Vector3(1, 0, 0);

    if (Math.abs(tangentX.dot(up)) > 0.9) {
        tangentX.set(0, 0, 1);
    }

    tangentX
        .addScaledVector(up, -tangentX.dot(up))
        .normalize();

    const tangentZ = new THREE.Vector3()
        .crossVectors(up, tangentX)
        .normalize();

    const coneAngle = THREE.MathUtils.degToRad(coneAngleDeg);

    const directions: THREE.Vector3[] = [];

    // Center ray
    directions.push(down.clone());

    // Ring rays
    for (let i = 0; i < rayCount; i++) {
        const azimuth = (i / rayCount) * Math.PI * 2;

        const ringDir = tangentX
            .clone()
            .multiplyScalar(Math.cos(azimuth))
            .add(
                tangentZ.clone()
                    .multiplyScalar(Math.sin(azimuth))
            );

        const dir = down
            .clone()
            .multiplyScalar(Math.cos(coneAngle))
            .add(
                ringDir.multiplyScalar(Math.sin(coneAngle))
            )
            .normalize();

        directions.push(dir);
    }

    const averageNormal = new THREE.Vector3();
    let totalWeight = 0;

    for (const dir of directions) {

        const ray = new rapier.Ray(
            {
                x: center.x,
                y: center.y,
                z: center.z,
            },
            {
                x: dir.x,
                y: dir.y,
                z: dir.z,
            }
        );

        const hit = world.castRayAndGetNormal(
            ray,
            rayLength,
            true,
            undefined,
            undefined,
            excludeCollider
        );

        if (!hit) continue;

        const normal = new THREE.Vector3(
            hit.normal.x,
            hit.normal.y,
            hit.normal.z
        );

        // Optional: reject nearly vertical walls
        // if (normal.dot(up) < 0.2) continue;

        const weight = 1 / (0.01 + hit.timeOfImpact);

        averageNormal.addScaledVector(
            normal,
            weight
        );

        totalWeight += weight;
    }

    if (totalWeight === 0) {
        return null;
    }

    return averageNormal
        .divideScalar(totalWeight)
        .normalize();
}