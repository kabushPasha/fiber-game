import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GridPositionProvider } from "../Classes/GridPositionProvider"
import { AddCallbackToParentEvent } from "./AddCallbackToParentEvent"
import { SimpleTarget } from "../../SimpleTarget"
import { Timer, type TimerHandle } from "./Timer"
interface TaskProps {
  onTaskEnd?: () => void
}

export const Task = ({ onTaskEnd }: TaskProps) => {
  const gridPositionProvider = useRef(new GridPositionProvider({}))

  const [score, setScore] = useState(0)
  const timerRef = useRef<TimerHandle>(null)

  useEffect(() => {
    if (score > 5) {
      console.log("Task finished!", timerRef.current?.getTime());      
      onTaskEnd?.()
    }
  }, [score, onTaskEnd])

  return (
    <>
      <Timer ref={timerRef} autoStart showUI={true}/>

      <group name="Task">
        {Array.from({ length: 3 }).map((_, i) => (
          <SimpleTarget key={i}>
            <AddCallbackToParentEvent
              event="hit"
              callback={(e) => gridPositionProvider.current.setPosition(e.source)}
            />
            <AddCallbackToParentEvent
              event="hit"
              callback={() => {
                const snd = new Audio("sfx/bullet-metal-hit.mp3")
                snd.volume = 0.1
                snd.play()
              }}
            />
            <AddCallbackToParentEvent
              event="hit"
              callback={() => setScore((prev) => prev + 1)}
            />
            <AddCallbackToParentEvent
              event="mount"
              callback={(e) => gridPositionProvider.current.setPosition(e.source)}
            />
            <AddCallbackToParentEvent
              event="restart"
              callback={(e) => gridPositionProvider.current.setPosition(e.source)}
            />
          </SimpleTarget>
        ))}
      </group>
    </>
  )
}
