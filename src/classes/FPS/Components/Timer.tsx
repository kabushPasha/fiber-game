import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three";

type TimerProps = {
  showUI?: boolean
  position?: { top?: number; right?: number; left?: number; bottom?: number }
  fontSize?: number
}

export const Timer = (
  (
    {
      showUI = true,
      position = { top: 0, right: 0 },
      fontSize = 24,
    }: TimerProps
  ) => {

    const [time, setTime] = useState(0)

    const ref = useRef<THREE.Object3D>(null!);

    // Advance time every frame
    useFrame((_, delta) => {
      setTime((t) => t + delta)
      const parent = ref.current?.parent as THREE.Group;
      parent.userData["time"] = time;
    })

    // Render UI if requested
    if (!showUI) return null

    return (
      <>
        <group name="Timer" ref={ref} />

        <Html calculatePosition={() => [0, 0]}>
          <div
            style={{
              position: "absolute",
              color: "white",
              fontSize,
              fontFamily: "monospace",
              zIndex: 100,
              ...position,
            }}
          >
            Time: {time.toFixed(2)}s
          </div>
        </Html>
      </>
    )
  }
)
