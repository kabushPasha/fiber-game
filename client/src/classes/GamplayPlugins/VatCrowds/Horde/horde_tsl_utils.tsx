
import { instanceIndex, PI2, rand, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";


export const random_2d_dir = (uv: THREE.Node = instanceIndex) => {
    return vec3(
        rand(uv).mul(PI2).sin(),
        0,
        rand(uv).mul(PI2).cos()
    )
}
