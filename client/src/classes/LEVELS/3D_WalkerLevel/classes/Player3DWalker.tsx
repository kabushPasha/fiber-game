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

const UP = new THREE.Vector3(0, 1, 0);

export function Walker3D_Player() {
    const body = useRef<RapierRigidBody>(null);

    const { world, rapier } = useRapier();
    const [, get] = useKeyboardControls();

    // ----------------------------
    // DEBUG REFS (Three objects)
    // ----------------------------
    const originMesh = useRef<THREE.Mesh>(null);
    const hitMesh = useRef<THREE.Mesh>(null);
    const lineRef = useRef<THREE.Line>(null);

    // reusable vectors (IMPORTANT: avoid GC every frame)
    const tmpOrigin = new THREE.Vector3();
    const tmpHit = new THREE.Vector3();
    const tmpNormalEnd = new THREE.Vector3();
    const tmpDir = new THREE.Vector3(0, -1, 0);

    useFrame(({ camera }, delta) => {
        const rb = body.current;
        if (!rb) return;

        const { forward, backward, left, right, jump } = get();
        const velocity = rb.linvel();

        //world.gravity = { x: 0, y: -10, z: 0 };

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
        //console.log(cameraForward);
        const cameraRight = new THREE.Vector3().crossVectors(cameraForward, up).normalize();



        const moveDir = new THREE.Vector3();

        if (forward) moveDir.add(cameraForward);
        if (backward) moveDir.sub(cameraForward);
        if (right) moveDir.add(cameraRight);
        if (left) moveDir.sub(cameraRight);

        const moveSpeed = 6;


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

        tmpOrigin.set(pos.x, pos.y, pos.z);

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

        // ----------------------------
        // DEBUG UPDATE (NO REACT STATE)
        // ----------------------------

        // origin sphere
        if (originMesh.current) {
            originMesh.current.position.copy(tmpOrigin);
        }

        if (hit) {
            //console.log(cameraUp);
            world.gravity = { x: -hit.normal.x * 10, y: -hit.normal.y * 10, z: -hit.normal.z * 10 };

        } else {
            if (hitMesh.current) hitMesh.current.visible = false;
        }


        // Orient towards UP
        /*
        const currentQuat = new THREE.Quaternion();
        const targetQuat = new THREE.Quaternion();
        const WORLD_UP = new THREE.Vector3(0, 1, 0);


        targetQuat.setFromUnitVectors(WORLD_UP, up);
        const rot = rb.rotation();

        currentQuat.set(
            rot.x,
            rot.y,
            rot.z,
            rot.w
        );

        // larger = faster alignment
        const alignSpeed = 2;

        // framerate-independent interpolation
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
        );*/


        alignBodyToUp(
            rb,
            up,
            delta,
            2
        );




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