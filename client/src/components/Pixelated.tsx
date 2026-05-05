import { useThree } from "@react-three/fiber"
import { folder, useControls } from "leva"
import { useEffect } from "react"
import * as THREE from "three"

export function Pixelated({ resolution = 256, enabled = true }) {
  const { gl, camera } = useThree()

  const [controls, set] = useControls(() => ({
    "Render": folder({
      Pixelate: folder({
        enabled: enabled,
        resolution: { value: resolution, options: [128, 256, 512], },
      }, { collapsed: true })
    })
  }))

  useEffect(() => {
    set({ enabled, resolution });
  }, [enabled, resolution, set]);


  useEffect(() => {
    if (!controls.enabled) {
      // reset canvas to default rendering if disabled
      gl.domElement.style.imageRendering = "auto"
      gl.setSize(window.innerWidth, window.innerHeight, false)
      //console.log(window.innerWidth)
      return
    }

    // Make upscaled canvas look pixelated
    gl.domElement.style.imageRendering = "pixelated"
    gl.domElement.style.imageRendering = "crisp-edges"

    function onResize() {
      let camAspect: number

      if (camera instanceof THREE.PerspectiveCamera) {
        camAspect = camera.aspect
      } else if (camera instanceof THREE.OrthographicCamera) {
        camAspect = (camera.right - camera.left) /
          (camera.top - camera.bottom)
      } else {
        return
      }

      // Calculate width and height in “virtual pixels”
      let width: number
      let height: number

      if (camAspect > 1) {
        width = controls.resolution * camAspect
        height = controls.resolution
      } else {
        width = controls.resolution
        height = controls.resolution / camAspect
      }

      // Render at low resolution, but scale to canvas size
      gl.setSize(width, height, false)
    }

    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [gl, camera, resolution, controls])

  return null
}
