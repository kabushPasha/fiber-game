import { useFrame } from "@react-three/fiber"
import { useGameObject3D } from "../GameObjectContext"
import * as THREE from "three";
import { useKeyboardControls } from "@react-three/drei";
import { useTerrain } from "../Terrain/TerrainProvider";


export function MoveByVel() {
    const { objectRef } = useGameObject3D()

    const force = new THREE.Vector3(0, -30, 0);

    useFrame((_, delta) => {
        const obj = objectRef.current
        if (!obj) return

        const vel: THREE.Vector3 = obj.userData.vel ??= new THREE.Vector3(0, 0, 0)

        // Move object
        obj.position.addScaledVector(vel, delta)
        // Gravity
        vel.addScaledVector(force, delta)
    }, -6)

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
            obj.userData.vel.y = Math.max( obj.userData.vel.y, 0)
            obj.userData.canJump = true
            obj.userData.grounded = true                        
        }
        else {
            obj.userData.grounded = false            
        }

        obj.userData.ground_distance = obj.position.y - groundY;
    })

    return null
}


// No terrain Variant
export function GroundClampSimple() {
    const { objectRef } = useGameObject3D()
    const worldPos = new THREE.Vector3()

    useFrame(() => {
        const obj = objectRef.current
        if (!obj || !obj.userData.vel) return

        // Get world position
        obj.getWorldPosition(worldPos)

        // Determine ground height
        const groundY = 0

        if (worldPos.y <= groundY) {
            obj.position.y = groundY
            obj.userData.vel.y = Math.max( obj.userData.vel.y, 0)
            obj.userData.canJump = true
            obj.userData.grounded = true                        
        }
        else {
            obj.userData.grounded = false            
        }

        obj.userData.ground_distance = obj.position.y - groundY;
    })

    return null
}