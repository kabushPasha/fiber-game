import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type TargetEvent = {
  event: "mount" | "hit" | "hover" | "tick" | string; // string allows future custom events
  source: THREE.Object3D;
  delta: number; // optional, only relevant for hover/tick
}

type AddCallbackToParentEventProps = {
  event: string; // Event name, e.g., "hit", "hover", "reset"
  callback: (e: any) => void; // Function to run when event fires
  dispatcher?: THREE.EventDispatcher; // Optional, defaults to parent mesh
};

export function AddCallbackToParentEvent({ event, callback, dispatcher }: AddCallbackToParentEventProps) {
  const ref = useRef<THREE.Object3D>(null!);

  useEffect(() => {
    // If dispatcher is provided, use it; otherwise use parent
    const targetDispatcher = (dispatcher ?? ref.current?.parent) as THREE.EventDispatcher<any>;
    if (!targetDispatcher) return;

    targetDispatcher.addEventListener(event, callback);

    return () => {
      targetDispatcher.removeEventListener(event, callback);
    };
  }, [event, callback, dispatcher]);

  return <group ref={ref} />; // invisible helper
}

export function AddHitCallback({ callback }: { callback: (e: TargetEvent) => void }) {
  return <AddCallbackToParentEvent event="hit" callback={callback} />
}

export function AddMountCallback({ callback }: { callback: (e: TargetEvent) => void }) {
  return <AddCallbackToParentEvent event="mount" callback={callback} />
}

export function AddHoverCallback({ callback }: { callback: (e: TargetEvent) => void }) {
  return <AddCallbackToParentEvent event="hover" callback={callback} />
}

export function AddTickCallback({ callback }: { callback: (e: TargetEvent) => void }) {
  return <AddCallbackToParentEvent event="tick" callback={callback} />
}

export function TickComponent() {
  const ref = useRef<THREE.Object3D>(null!);

  useFrame((_, delta) => {    
    ref.current.parent!.dispatchEvent({ type: "tick", source: ref.current.parent, delta })
  })

  return (<group name="TickComponent" ref={ref} />)
}
