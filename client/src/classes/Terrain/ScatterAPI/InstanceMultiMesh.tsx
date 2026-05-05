import * as THREE from "three/webgpu";
import { useMemo, useRef } from "react";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { normalLocal, positionLocal, transformNormalToView, vec4 } from "three/tsl";
import { useMeshRandomizer } from "./MeshRandomizerProvider";

type InstanceMultiMeshProps = React.PropsWithChildren<{
    mesh_id?: number,
}>

// --- InstanceMesh using Context ---
export function InstanceMultiMesh({ mesh_id = 0, children }: InstanceMultiMeshProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const { count,instanceMatrix } = useMeshRandomizer(mesh_id);


    const compute_mat = useMemo(() => {
        //console.log("Update MESH Mat");
        const mat = new MeshStandardNodeMaterial();
        mat.positionNode = instanceMatrix.mul(positionLocal);
        const normalWorld = instanceMatrix.mul(vec4(normalLocal, 0)).xyz;
        mat.normalNode = transformNormalToView(normalWorld);

        return mat;
    }, [instanceMatrix]);

    const geometry = useMemo(() => {
        const g = new THREE.BoxGeometry(1, 1, 1);
        g.translate(0, 0.5, 0);
        return g;
    }, []);


    return <instancedMesh ref={meshRef} args={[geometry, compute_mat, count]} position={[0, 5, 0]} >
        {children}
    </instancedMesh>;
}




