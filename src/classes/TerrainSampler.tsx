import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useTerrain } from "./Terrain/TerrainProvider";


export function TerrainSampler() {
  const { camera } = useThree();
  const terrain = useTerrain();
  const groupRef = useRef<THREE.Group>(null);
  const worldPos = new THREE.Vector3();

  useFrame(() => {
    if (!terrain || !groupRef.current) return;

    const parent = groupRef.current.parent;
    if (!parent) return;
    
    parent.getWorldPosition(worldPos);

    const sampledHeight = terrain.getHeightAtPos(worldPos);

    parent.position.setY(sampledHeight);
    camera.position.setY(sampledHeight + 1.75);
  });

  return <group ref={groupRef} />;
}