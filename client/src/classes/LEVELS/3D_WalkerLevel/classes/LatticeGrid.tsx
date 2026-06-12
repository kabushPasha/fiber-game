import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { attribute, instanceIndex, normalLocal, positionLocal, storage, texture, transformNormalToView, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";
import { applyNearestTextureFilter } from "../3D_WalkerLevel";

export function Lattice() {
    const tile_mesh = useGLTF("models/Level/tile_floor.glb");
    console.log("Tile", tile_mesh);

    const [mat, count, geo] = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        const wrapped = LatticeWrap(tile_mesh.meshes.lattice_wall.geometry as THREE.BufferGeometry, 15);

        const tile = tile_mesh.meshes.tile_wall

        const count = wrapped.count;
        mat.positionNode = wrapped.worldP;
        mat.normalNode = wrapped.worldN;
        const map_diffuse = (tile.material as THREE.MeshStandardMaterial).map!
        mat.colorNode = texture(map_diffuse).mul(wrapped.Cd);
        return [mat, count, tile.geometry];
    }, [tile_mesh]);


    const [mat1, count1, geo1] = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        const wrapped = LatticeWrap(tile_mesh.meshes.lattice_floor.geometry as THREE.BufferGeometry);

        const tile = tile_mesh.meshes.tile_floor

        const count = wrapped.count;
        mat.positionNode = wrapped.worldP;
        mat.normalNode = wrapped.worldN;
        const map_diffuse = (tile.material as THREE.MeshStandardMaterial).map!
        mat.colorNode = texture(map_diffuse).mul(wrapped.Cd);
        return [mat, count, tile.geometry];
    }, [tile_mesh]);


    const [mat2, count2, geo2] = useMemo(() => {
        const mat = new THREE.MeshStandardNodeMaterial()
        const wrapped = LatticeWrap(tile_mesh.meshes.lattice_ceil.geometry as THREE.BufferGeometry, 4);

        const tile = tile_mesh.meshes.tile_ceil

        const count = wrapped.count;
        mat.positionNode = wrapped.worldP;
        mat.normalNode = wrapped.worldN;
        const map_diffuse = (tile.material as THREE.MeshStandardMaterial).map!
        mat.colorNode = texture(map_diffuse).mul(wrapped.Cd);
        return [mat, count, tile.geometry];
    }, [tile_mesh]);



    useEffect(() => {
        applyNearestTextureFilter(tile_mesh.scene);
    }, [tile_mesh]);

    return <>
        <instancedMesh args={[geo, mat, count]} frustumCulled={false} />
        <instancedMesh args={[geo1, mat1, count1]} frustumCulled={false} />
        <instancedMesh args={[geo2, mat2, count2]} frustumCulled={false} />
    </>

}


export function LatticeWrap(geometry: THREE.BufferGeometry, amp: number = 8) {
    console.log("lattice", geometry);

    const pos_att = geometry.attributes.position as THREE.BufferAttribute
    const posBuffer = storage(pos_att, 'vec3', pos_att.count);

    const N_att = geometry.attributes.normal as THREE.BufferAttribute
    const NBuffer = storage(N_att, 'vec3', N_att.count);


    const srcIndex = geometry.index!;
    //const count = srcIndex.count / (6*4);
    const count = srcIndex.count / (6);
    const indexStorage = new THREE.StorageBufferAttribute(srcIndex.array.slice(), 1);
    const index_buffer = storage(indexStorage, 'uint');

    //const index = instanceIndex.mul(6*4);
    const index = instanceIndex.mul(6);
    const i0 = index_buffer.element(index);
    const i1 = index_buffer.element(index.add(2));
    const i2 = index_buffer.element(index.add(3));
    const i3 = index_buffer.element(index.add(5));

    const p0 = posBuffer.element(i0)
    const p1 = posBuffer.element(i1)
    const p2 = posBuffer.element(i2)
    const p3 = posBuffer.element(i3)

    const rest = attribute("position");

    const P = positionLocal.y.mix(
        positionLocal.x.mix(p1, p0),
        positionLocal.x.mix(p2, p3))

    const N = positionLocal.y.mix(
        positionLocal.x.mix(NBuffer.element(i1), NBuffer.element(i0)),
        positionLocal.x.mix(NBuffer.element(i2), NBuffer.element(i3)))

    function sampleCd(cd_att: THREE.BufferAttribute) {
        const cdBuffer = storage(cd_att, "vec3", cd_att.count);
        return rest.y.mix(
            rest.x.mix(cdBuffer.element(i1), cdBuffer.element(i0)),
            rest.x.mix(cdBuffer.element(i2), cdBuffer.element(i3))
        );
    }

    const Cd = geometry.attributes.color
        ? sampleCd(geometry.attributes.color as THREE.BufferAttribute)
        : vec3(1.0);


    const worldP = P.add(N.mul(positionLocal.z).mul(amp));

    // Normal Transformation
    const Tu = rest.y.mix(p1.sub(p0), p2.sub(p3));
    const Tv = rest.x.mix(p3.sub(p0), p2.sub(p1));

    const Tw = Tu.cross(Tv).normalize();
    const srcN = normalLocal;
    const worldN = transformNormalToView(
        Tu.mul(srcN.x).add(Tv.mul(srcN.y)).add(Tw.mul(srcN.z)).normalize().oneMinus()
    );

    //const Cd = rest;

    return {
        worldP,
        worldN,
        Cd,
        count
    }

}

export function LatticeWrap3x3(geometry: THREE.BufferGeometry, amp: number = 8) {
    console.log("lattice", geometry);

    const pos_att = geometry.attributes.position as THREE.BufferAttribute
    const posBuffer = storage(pos_att, 'vec3', pos_att.count);

    const N_att = geometry.attributes.normal as THREE.BufferAttribute
    const NBuffer = storage(N_att, 'vec3', N_att.count);


    const srcIndex = geometry.index!;
    const count = srcIndex.count / (6 * 4);
    //const count = srcIndex.count / (6);
    const indexStorage = new THREE.StorageBufferAttribute(srcIndex.array.slice(), 1);
    const index_buffer = storage(indexStorage, 'uint');

    const index = instanceIndex.mul(6 * 4);
    //const index = instanceIndex.mul(6);
    const i00 = index_buffer.element(index.add(0));
    const i10 = index_buffer.element(index.add(2));    
    const i20 = index_buffer.element(index.add(8));

    const i01 = index_buffer.element(index.add(5));
    const i11 = index_buffer.element(index.add(1));    
    const i21 = index_buffer.element(index.add(7));        

    const i02 = index_buffer.element(index.add(23));
    const i12 = index_buffer.element(index.add(21));
    const i22 = index_buffer.element(index.add(13));
    
    

    const p0 = posBuffer.element(i00)
    const p1 = posBuffer.element(i10)
    const p2 = posBuffer.element(i11)
    const p3 = posBuffer.element(i01)

    const rest = attribute("position");
    /*
    function BufferSample(buffer: THREE.StorageBufferNode) {
        return rest.y.mix(
            rest.x.mix(buffer.element(i10), buffer.element(i00)),
            rest.x.mix(buffer.element(i11), buffer.element(i01))
        );
    }

        */

        
function BufferSample(buffer: THREE.StorageBufferNode) {

    const R0 = rest.x.mix(
        rest.x.mix(buffer.element(i20), buffer.element(i10)),
        buffer.element(i00)
    );

    const R1 = rest.x.mix(
        rest.x.mix(buffer.element(i21), buffer.element(i11)),
        buffer.element(i01)
    );

    const R2 = rest.x.mix(
        rest.x.mix(buffer.element(i22), buffer.element(i12)),
        buffer.element(i02)
    );

    return rest.y.mix(
        rest.y.mix(R0, R1),
        R2
    );
}

    const P = BufferSample(posBuffer);
    const N = BufferSample(NBuffer);

    function sampleCd(cd_att: THREE.BufferAttribute) {
        const cdBuffer = storage(cd_att, "vec3", cd_att.count);
        return BufferSample(cdBuffer);
    }

    const Cd = geometry.attributes.color
        ? sampleCd(geometry.attributes.color as THREE.BufferAttribute)
        : vec3(1.0);


    const worldP = P.add(N.mul(positionLocal.z).mul(amp));

    // Normal Transformation
    const Tu = rest.y.mix(p1.sub(p0), p2.sub(p3));
    const Tv = rest.x.mix(p3.sub(p0), p2.sub(p1));

    const Tw = Tu.cross(Tv).normalize();
    const srcN = normalLocal;
    const worldN = transformNormalToView(
        Tu.mul(srcN.x).add(Tv.mul(srcN.y)).add(Tw.mul(srcN.z)).normalize().oneMinus()
    );

    //const Cd = rest;

    return {
        worldP,
        worldN,
        Cd,
        count
    }

}




type AutoLatticeProps = {
    gltfPath: string;
};

export function AutoLattice({ gltfPath }: AutoLatticeProps) {
    const gltf = useGLTF(gltfPath);


    const meshes = useMemo(() => {
        const entries = Object.entries(gltf.meshes)
            .filter(([name]) => name.startsWith("lattice_"))
            .map(([latticeName, latticeMesh]) => {

                const tileName = latticeName.replace(
                    /^lattice_/,
                    "tile_"
                );

                const tileMesh = gltf.meshes[tileName];

                if (!tileMesh) {
                    console.warn(`Missing tile mesh "${tileName}" for "${latticeName}"`);
                    return null;
                }


                const mat = new THREE.MeshStandardNodeMaterial();
                const wrapped = LatticeWrap3x3(latticeMesh.geometry as THREE.BufferGeometry);

                mat.positionNode = wrapped.worldP;
                mat.normalNode = wrapped.worldN;

                const srcMat = tileMesh.material as THREE.MeshStandardMaterial;

                const baseColor = srcMat.map
                    ? texture(srcMat.map)
                    : vec3(0.5);

                mat.colorNode = baseColor.mul(wrapped.Cd);

                return {
                    geo: tileMesh.geometry,
                    mat,
                    count: wrapped.count,
                    name: latticeName,
                };
            })
            .filter(Boolean);

        return entries;
    }, [gltf]);

    useEffect(() => {
        applyNearestTextureFilter(gltf.scene);
    }, [gltf]);

    return (
        <>
            {meshes.map((m) => (
                <instancedMesh
                    key={m!.name}
                    args={[m!.geo, m!.mat, m!.count]}
                    frustumCulled={false}
                />
            ))}
        </>
    );
}