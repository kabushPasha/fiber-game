import { createContext, useContext, useState, type ReactNode } from "react"
import * as THREE from "three"

interface PlayerContextType {
  player: THREE.Group | null
  setPlayer: (player: THREE.Group | null) => void
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) throw new Error("usePlayer must be used within PlayerProvider")
  return context
}

interface PlayerProviderProps {
  children: ReactNode
}

export function PlayerProvider({ children }: PlayerProviderProps) {
  const [player, setPlayer] = useState<THREE.Group | null>(null)

  return (
    <PlayerContext.Provider value={{ player, setPlayer }}>
      {children}
    </PlayerContext.Provider>
  )
}