import React, { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from 'three';


type SimpleTargetProps = {
    position?: [number, number, number],
}

export const SimpleTarget = ({ position = [3, 0, 0], children }: React.PropsWithChildren<SimpleTargetProps>) => {
    const ref = useRef<THREE.Mesh>(null!)
    const [hovered, setHover] = useState(false)

    // Simple rotation animation
    useFrame((_, delta) => {
        if (ref.current) { ref.current.rotation.x += delta }
        if (hovered) (ref.current as any)?.dispatchEvent({ type: "hover", source: ref.current, delta })
    })

    // This is our “hit event” handler
    const handleHit = () => { (ref.current as any)?.dispatchEvent?.({ type: "hit", source: ref.current }) }

    useEffect(() => {
        (ref.current as any)?.dispatchEvent({ type: "mount", source: ref.current })
    }, [])

    return (
        <mesh
            position={position}
            ref={ref}
            onPointerOver={(e) => {
                e.stopPropagation()
                setHover(true)
            }}
            onPointerOut={() => setHover(false)}
            onClick={(e) => {
                e.stopPropagation()
                handleHit();
            }}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={hovered ? "hotpink" : "#2f74c0"} />

            {children}
        </mesh>
    )
}
