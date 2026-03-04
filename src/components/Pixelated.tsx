import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import * as THREE from "three"

export function Pixelated({ resolution = 256 }) {
  const { gl, camera } = useThree()

  useEffect(() => {
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
        width = resolution * camAspect
        height = resolution
      } else {
        width = resolution
        height = resolution / camAspect
      }

      // Render at low resolution, but scale to canvas size
      gl.setSize(width, height, false)
    }

    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [gl, camera, resolution])

  return null
}
