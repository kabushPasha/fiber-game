import { useEffect, useRef } from "react";
import * as THREE from "three";

type AddCallbackToParentEventProps = {
  event: string; // Event name, e.g., "hit", "hover", "reset"
  callback: (e: any) => void; // Function to run when event fires
  dispatcher?: THREE.EventDispatcher; // Optional, defaults to parent mesh
};

export function AddCallbackToParentEvent({ event, callback, dispatcher }: AddCallbackToParentEventProps) {
  const ref = useRef<THREE.Object3D>(null!);

  useEffect(() => {
    // If dispatcher is provided, use it; otherwise use parent
    const targetDispatcher = dispatcher ?? ref.current?.parent;
    if (!targetDispatcher) return;

    targetDispatcher.addEventListener(event, callback);

    return () => {
      targetDispatcher.removeEventListener(event, callback);
    };
  }, [event, callback, dispatcher]);

  return <group ref={ref} />; // invisible helper
}
