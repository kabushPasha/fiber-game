import { useFrame } from "@react-three/fiber"
import { useGameObject3D } from "../GameObjectContext"
import * as THREE from "three";
import { useKeyboardControls } from "@react-three/drei";
import { useEffect } from "react";
import { useTerrain } from "../Terrain/TerrainProvider";


export function MoveByVel() {
    const { objectRef } = useGameObject3D()

    const force = new THREE.Vector3(0, -30, 0);

    useEffect(() => {
        if (!objectRef.current.userData.vel)
            objectRef.current.userData.vel = new THREE.Vector3(0, 0, 0)
            objectRef.current.userData.canJump = true;
    }, [objectRef])

    useFrame((_, delta) => {
        if (!objectRef.current) return

        const vel = objectRef.current.userData.vel

        // Move object
        objectRef.current.position.addScaledVector(vel, delta)
        // Gravity
        vel.addScaledVector(force, delta)

        // Ground clamp
        if (objectRef.current.position.y <= 0) {
            objectRef.current.position.y = 0
            vel.y = 0
        }
    })

    return null
}

export function Jump() {
    const { objectRef } = useGameObject3D()
    const [, get] = useKeyboardControls()

    useFrame(() => {
        if (!objectRef.current) return
        const { jump } = get()
        if (jump && objectRef.current.userData.canJump) {
            objectRef.current.userData.vel.y = 20
            objectRef.current.userData.canJump = false
        }
    }, -5)

    return null
}


export function GroundClamp() {
    const { objectRef } = useGameObject3D()
    const terrain = useTerrain() // may be undefined
    const worldPos = new THREE.Vector3()

    useFrame(() => {
        const obj = objectRef.current
        if (!obj || !obj.userData.vel) return

        // Get world position
        obj.getWorldPosition(worldPos)

        // Determine ground height
        const groundY = terrain ? terrain.getHeightAtPos(worldPos) : 0

        if (worldPos.y <= groundY) {
            obj.position.y = groundY
            obj.userData.vel.y = 0
            obj.userData.canJump = true
        }
    })

    return null
}