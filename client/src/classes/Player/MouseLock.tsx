import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useThree } from "@react-three/fiber"

type MouseDelta = { x: number; y: number }

type MouseLockContextType = {
  consumeDelta: () => MouseDelta
  isLocked: boolean
  unlock: () => void
  lock: () => void


  lockOnClick: boolean
  setLockOnClick: React.Dispatch<React.SetStateAction<boolean>>
}

const MouseLockContext = createContext<MouseLockContextType>(null!)

export function MouseLockProvider({ children }: { children: React.ReactNode }) {
  const { gl, setEvents, get } = useThree()
  const canvas = gl.domElement

  const movement = useRef({ x: 0, y: 0 })
  const oldCompute = useRef<any>(null)

  const [isLocked, setLocked] = useState(false)

  const [lockOnClick, setLockOnClick] = useState(true)
  const lockOnClickRef = useRef(true)
  useEffect(() => { lockOnClickRef.current = lockOnClick }, [lockOnClick])


  useEffect(() => {
    oldCompute.current = get().events.compute

    const onClick = () => {
      if (!lockOnClickRef.current) return
      lock()
    }

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas
      setLocked(locked)

      if (locked) {
        setEvents({
          compute(_, state) {
            const offsetX = state.size.width / 2
            const offsetY = state.size.height / 2

            state.pointer.set(
              (offsetX / state.size.width) * 2 - 1,
              -(offsetY / state.size.height) * 2 + 1
            )

            state.raycaster.setFromCamera(state.pointer, state.camera)
          },
        })
      } else {
        setEvents({ compute: oldCompute.current })
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return

      movement.current.x += e.movementX
      movement.current.y += e.movementY
    }

    canvas.addEventListener("click", onClick)
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("pointerlockchange", onPointerLockChange)

    return () => {
      canvas.removeEventListener("click", onClick)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("pointerlockchange", onPointerLockChange)

      setEvents({ compute: oldCompute.current })
    }
  }, []) // IMPORTANT: empty deps

  const consumeDelta = () => {
    const delta = { ...movement.current }
    movement.current.x = 0
    movement.current.y = 0
    return delta
  }
  // unlock function
  const unlock = () => {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock()
    }
  }

  const lock = () => {
    if (!lockOnClickRef.current) return
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock().catch(err => {
        console.warn("Lock failed:", err);
        // Retry after some time ??
        //window.setTimeout(() => { lock(); }, 100)
      });
    }
  }

  const value = useMemo(
    () => ({
        consumeDelta,
        isLocked,
        unlock,
        lock,
        lockOnClick,
        setLockOnClick,
    }),
    [isLocked, lockOnClick]
)

  return (
    <MouseLockContext.Provider value={value}>
      {children}
    </MouseLockContext.Provider>
  )
}

export function useMouseLock() {
  return useContext(MouseLockContext)
}