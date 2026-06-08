import { useThree } from "@react-three/fiber"
import { GameObject3D } from "../../../GameObjectContext"
import { degToRad } from "three/src/math/MathUtils.js"

export function BasicPerspCamera() {
    const { camera } = useThree()
    return <GameObject3D name="PlayerNeck" rotation={[degToRad(-60), 0, 0]}>
        <primitive object={camera} position={[0, 0, 40]} />
    </GameObject3D>
}
