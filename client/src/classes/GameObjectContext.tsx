import { createContext, forwardRef, useContext, useRef, type ReactNode, type RefObject } from "react"
import * as THREE from "three"

/**
 * GameObject3D
 * -------------
 * A reusable React + Three.js wrapper component that creates a shared
 * THREE.Group and exposes its reference through React Context.
 *
 * This allows any nested child component to access the parent 3D object
 * without prop drilling by using the `useGameObject3D()` hook.
 *
 */

interface GameObject3DContextValue {
  objectRef: RefObject<THREE.Object3D>
}

const GameObject3DContext = createContext<GameObject3DContextValue | null>(null)

export function useGameObject3D() {
  const ctx = useContext(GameObject3DContext)
  if (!ctx) { throw new Error("useGameObject3D must be used inside GameObject3DContext") }
  return ctx
}

export { GameObject3DContext }

// Provider
interface GameObject3DProps {
  children?: ReactNode
  name?: string
  [key: string]: any // allow any other <group> props
}

export const GameObject3D = forwardRef<THREE.Group, GameObject3DProps>(
  ({ children, name, ...groupProps }, forwardedRef) => {
    const internalRef = useRef<THREE.Group>(null!)

    const ref = (forwardedRef ?? internalRef) as React.MutableRefObject<THREE.Group>

    return (
      <GameObject3DContext.Provider value={{ objectRef: ref }}>
        <group ref={ref} name={name} {...groupProps}>
          {children}
        </group>
      </GameObject3DContext.Provider>
    )
  }
)


