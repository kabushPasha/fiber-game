import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useTerrain } from "./Terrain/TerrainProvider";


export function TerrainSampler() {
  const { camera } = useThree();
  const terrain = useTerrain();
  const groupRef = useRef<THREE.Group>(null);
  const worldPos = new THREE.Vector3();

useFrame((state, delta) => {
  if (!terrain || !groupRef.current) return;

  const parent = groupRef.current.parent;
  if (!parent) return;

  parent.getWorldPosition(worldPos);

  const targetHeight = terrain.getHeightAtPos(worldPos);

  // Smooth parent Y
  parent.position.y = THREE.MathUtils.damp(
    parent.position.y,
    targetHeight,
    8,        // smoothing factor (higher = snappier)
    delta
  );

  // Smooth camera Y
  camera.position.y = THREE.MathUtils.damp(
    camera.position.y,
    targetHeight + 1.75,
    8,
    delta
  );
});

  return <group ref={groupRef} />;
}