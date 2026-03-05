import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useTerrain } from "./TerrainProvider";


export function TerrainSampler() {
  const terrain = useTerrain();
  const groupRef = useRef<THREE.Group>(null);
  const worldPos = new THREE.Vector3();

  useFrame(() => {
    if (!terrain || !groupRef.current) return;

    const parent = groupRef.current.parent;
    if (!parent) return;

    parent.getWorldPosition(worldPos);
    parent.position.y = terrain.getHeightAtPos(worldPos);
  });

  return <group ref={groupRef} />;
}



export function SmoothCamera({ smooth = 16 }) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null!);

  const worldPos = new THREE.Vector3()  
  const camWorldPos = new THREE.Vector3()  

  useFrame((_, delta) => {    
    groupRef.current.getWorldPosition(worldPos);
    camera.getWorldPosition(camWorldPos);

    worldPos.y = THREE.MathUtils.damp(camWorldPos.y, worldPos.y, smooth, delta);
    camera.position.copy(worldPos); 
  })

  return <group ref={groupRef} position={[0,1.75,0]}/>
}