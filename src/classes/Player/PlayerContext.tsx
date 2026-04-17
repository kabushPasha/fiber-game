import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import * as THREE from "three"
import { uniform } from "three/tsl";

interface PlayerContextType {
  player: THREE.Group | null
  setPlayer: (player: THREE.Group | null) => void
  playerWorldPosition: THREE.Vector3;
  tsl_PlayerWorldPosition: ReturnType<typeof uniform<THREE.Vector3>>;
  tsl_PlayerVelocity: ReturnType<typeof uniform<THREE.Vector3>>;
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

  // Player world position vector
  const playerWorldPosition = useMemo(() => new THREE.Vector3(), []);


  // Uniform for shaders
  const tsl_PlayerWorldPosition = useMemo(() => uniform(new THREE.Vector3()), []);
  const tsl_PlayerVelocity = useMemo(() => uniform(new THREE.Vector3()), []);


  // Update positions every frame
  useFrame(() => {
    if (!player) return;
    player.getWorldPosition(playerWorldPosition);
    tsl_PlayerWorldPosition.value.copy(playerWorldPosition);
    tsl_PlayerVelocity.value.copy(player.userData.vel);
  });

  return (
    <PlayerContext.Provider value={{ player, setPlayer, playerWorldPosition, tsl_PlayerWorldPosition, tsl_PlayerVelocity }}>
      {children}
    </PlayerContext.Provider>
  )
}