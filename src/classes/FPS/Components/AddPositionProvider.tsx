import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GridPositionProvider } from "../Classes/GridPositionProvider";
import { SimplePositionProvider } from "../Classes/SimplePositionProvider";



export const useParentPositionProvider = (object: THREE.Object3D) => { object.parent?.userData.positionProvider.setPosition(object); }

export const AddPositionProvider = () => {
  const ref = useRef<THREE.Object3D>(null!);

  const provider = useRef( new SimplePositionProvider());

  useEffect(() => {
    if (!ref.current) return;
    const parent = ref.current.parent as THREE.Group;
    if (parent) { parent.userData.positionProvider = provider.current; }
  }, [provider]);

  return <group ref={ref} />; 
};


export const GridPositionProviderComponent = () => {
  const ref = useRef<THREE.Object3D>(null!);

  const provider = useRef( new GridPositionProvider({}));

  useEffect(() => {
    if (!ref.current) return;
    const parent = ref.current.parent as THREE.Group;
    if (parent) { parent.userData.positionProvider = provider.current; }
  }, [provider]);

  return <group ref={ref} />; 
};
