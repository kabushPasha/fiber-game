import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"

export type TimerHandle = {
  start: () => void
  pause: () => void
  reset: () => void
  getTime: () => number
}

type TimerProps = {
  autoStart?: boolean
  showUI?: boolean
  position?: { top?: number; right?: number; left?: number; bottom?: number }
  fontSize?: number
}

export const Timer = forwardRef<TimerHandle, TimerProps>(
  (
    {
      autoStart = true,
      showUI = true,
      position = { top: 0, right: 0},
      fontSize = 24,
    },
    ref
  ) => {
    const [time, setTime] = useState(0)
    const running = useRef(autoStart)

    // Advance time every frame
    useFrame((_, delta) => {
      if (!running.current) return
      setTime((t) => t + delta)
    })

    // Expose API to parent
    useImperativeHandle(
      ref,
      () => ({
        start: () => {
          running.current = true
        },
        pause: () => {
          running.current = false
        },
        reset: () => {
          running.current = false
          setTime(0)
        },
        getTime: () => time,
      }),
      [time]
    )

    // Render UI if requested
    if (!showUI) return null

    return (
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
    )
  }
)
