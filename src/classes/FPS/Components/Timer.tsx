import {  useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three";

type TimerProps = {
  onTimeout?: (e: any) => void
  showUI?: boolean
  position?: { top?: number; right?: number; left?: number; bottom?: number }
  fontSize?: number
  maxTime?: number | null
}

export const Timer = ((timerProps: TimerProps) => {

  const [time, setTime] = useState(0)

  const ref = useRef<THREE.Object3D>(null!);  

  // Advance time every frame
  useFrame((_, delta) => {
    setTime((t) => t + delta)
    const parent = ref.current?.parent as THREE.Group;
    parent.userData["time"] = time;
  
    //if (timerProps.maxTime && timerProps.maxTime < time)    timerProps.onTimeout?.();
    ref.current.parent!.dispatchEvent({ type: "tick", source: ref.current.parent, delta })
  })

  // Render UI if requested
  if (!timerProps.showUI) return null

  return (
    <>
      <group name="Timer" ref={ref} >      
      </group>

      <Html calculatePosition={() => [100, 10]}>
        <div
          style={{
            position: "absolute",
            color: "white",
            fontSize: timerProps.fontSize,
            fontFamily: "monospace",
            zIndex: 100,
            ...timerProps.position,
          }}
        >
          Time: {time.toFixed(2)}s
        </div>
      </Html>
    </>
  )
}
)
