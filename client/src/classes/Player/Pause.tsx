import { useKeyboardControls } from "@react-three/drei";
import { useCallback, useEffect, useState } from "react";
import { useMouseLock } from "./MouseLock";
import { useFrame, useThree } from "@react-three/fiber";

export function Pause() {
  const [paused, setPaused] = useState(false);

  const [, get] = useKeyboardControls(); // get current state
  const mouseLock = useMouseLock();
  const { gl } = useThree()
  const state = useThree(); 

  const [pointerLost, setPointerLost] = useState(false)

  const resume = useCallback(() => {
    state.setFrameloop("always");
    state.invalidate();
    mouseLock.lock();
    setPaused(false);
  }, [state, mouseLock]);

  const stop = useCallback(() => {
    setPaused(true);
    mouseLock.unlock();
    state.setFrameloop("never");
  }, [state, mouseLock]);

  useFrame(() => {
    const { pause } = get()
    if ((pause || pointerLost) && state.frameloop == 'always') {
      stop()     
      if (paused && pointerLost) setPointerLost(false);
    }
  })

  // Resume on Click Document
  useEffect(() => {
    if (!paused) return;
    const onClick = () => { resume(); }
    gl.domElement.addEventListener("click", onClick)
    return () => { gl.domElement.removeEventListener("click", onClick) }
  }, [paused])

  // Pause on Pointer Lock Change
  useEffect(() => {
    const onPointerLockChange = () => {
      //if (document.pointerLockElement == null) {setPointerLost(true); }
    }
    document.addEventListener("pointerlockchange", onPointerLockChange)
    return () => { document.removeEventListener("pointerlockchange", onPointerLockChange) }
  }, [stop])

  // Add UI on Paused
  /*
  const { mount } = useUI()

  useEffect(() => {
    const unmount = mount(() => {
      if (!paused) return null;
      return <>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "10vw",
            height: "10vh",
            backgroundColor: "#e02727",
            display: "flex",
            zIndex: 9999,
          }}
          onClick={() => { resume(); }}
        />
      </>
    }
    )
    return unmount
  }, [paused])
  */
  return null;
}
