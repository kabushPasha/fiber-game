import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useUI } from "../../../components/UIScreenContext";

export function useThreeEvent<K extends string>(
    object: THREE.EventDispatcher | null | undefined,
    eventName: K,
    handler: (event: any) => void
) {
    const handlerRef = useRef(handler)
    // Always keep latest handler
    useEffect(() => { handlerRef.current = handler }, [handler])

    useEffect(() => {
        if (!object) return
        const listener = (event: any) => { handlerRef.current(event) }
        object.addEventListener(eventName, listener)
        return () => { object.removeEventListener(eventName, listener) }
    }, [object, eventName])
}

export function UIComponent({ Component }: { Component: React.ComponentType<{ obj: THREE.Object3D }>;}) {
    const ref = useRef<THREE.Object3D>(null!);
    const { mount } = useUI();

    useEffect(() => {
        const target = ref.current.parent;
        if (!target) return;

        return mount(() => <Component obj={target} />);
    }, []);

    return <group ref={ref} />;
}