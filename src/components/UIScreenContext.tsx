// UIScreen.tsx
import {  createContext,  useContext,  useState,  type ReactNode,  useRef } from "react"

type UIEntry = {
  id: number
  component: () => ReactNode
}

type UIScreenContextType = {
  mount: (component: () => ReactNode) => () => void
}

const UIScreenContext = createContext<UIScreenContextType | null>(null)

export const useUI = () => {
  const ctx = useContext(UIScreenContext)
  if (!ctx) throw new Error("useUI must be used inside UIScreenProvider")
  return ctx
}

export const UIScreenProvider = ({ children }: { children: ReactNode }) => {
  const [elements, setElements] = useState<UIEntry[]>([])
  const idRef = useRef(0)

  const mount = (component: () => ReactNode) => {
    const id = idRef.current++

    setElements(prev => [...prev, { id, component }])

    return () => {
      setElements(prev => prev.filter(e => e.id !== id))
    }
  }

  return (
    <UIScreenContext.Provider value={{ mount }}>
      {children}

      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {elements.map(entry => (
          <div key={entry.id} style={{ pointerEvents: "auto" }}>
            {entry.component()}
          </div>
        ))}
      </div>
    </UIScreenContext.Provider>
  )
}