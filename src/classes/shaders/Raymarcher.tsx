import { useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo } from "react";
import { abs, bool, Break, cameraPosition, cameraProjectionMatrixInverse, cameraWorldMatrix, clamp, dot, float, Fn, getViewPosition, If, length, Loop, min, normalize, screenUV, sqrt, sub, uniform, vec2, vec3, vec4 } from "three/tsl";
import * as THREE from 'three/webgpu'

export const shapes = {
    sphere: Fn(([position, radius]: [any, any]) => {
        return length(position).sub(radius)
    }),


}

export const calcDiffuse = Fn(([nor, lig]: [any, any]) => {
    const N = normalize(nor);
    const L = normalize(lig);
    const dif = clamp(dot(N, L), 0.0, 1.0);
    return dif;
});

export const calcAmbientLight = Fn(([nor]: [any]) => {
    const N = normalize(nor);
    const dif = sqrt(clamp(float(0.5).add(float(0.5).mul(N.y)), float(0.0), float(1.0)));
    const ambientColor = vec3(0.40, 0.60, 1.15).mul(dif.mul(float(0.60)));
    return ambientColor;
});



export const calcSoftshadow = Fn((
    [ro, rd, mint, tmax, sdf]: [any, any, any, any, any]
) => {
    // Bounding volume adjustment
    const tp = float(20).sub(ro.y).div(rd.y);
    const tmaxAdjusted = float(tmax).toVar();
    If(tp.greaterThan(float(0.0)), () => { tmaxAdjusted.assign(min(tmaxAdjusted, tp)); });

    let res = float(1.0).toVar();
    let t = mint.toVar();

    Loop({ start: 0, end: 48 }, () => {
        const h = sdf(ro.add(rd.mul(t))).x;
        const s = clamp(float(8.0).mul(h).div(t), float(0.0), float(1.0));
        res.assign(min(res, s));

        const step = clamp(h, float(0.01), float(0.2));
        t.addAssign(step);

        If(res.lessThan(float(0.004)).or(t.greaterThan(tmaxAdjusted)), () => { Break(); });
    });

    res.assign(clamp(res, float(0.0), float(1.0)));

    // Smoothstep-like final curve
    return res.mul(res).mul(float(3.0).sub(res.mul(float(2.0))));
});

export const calcAO = Fn(([pos, nor, sdf]: [any, any, any]) => {
    let occ = float(0.0).toVar();
    let sca = float(1.0).toVar();

    Loop({ start: 0, end: 5 }, ({ i }) => {
        // h along normal
        const h = float(0.01).add(float(0.12).mul(i.div(float(4.0))));

        // SDF distance at offset
        const d = sdf([pos.add(nor.mul(h))]).x;

        // Accumulate occlusion (clamped to avoid negatives)
        occ.addAssign(clamp(h.sub(d), float(0.0), float(1.0)).mul(sca));

        // Reduce contribution of farther samples
        sca.mulAssign(float(0.95));

        // Early exit if occlusion is strong
        If(occ.greaterThan(float(0.35)), () => { Break(); });
    });

    // Clamp and bias with normal.y for directional AO
    const ao = clamp(float(1.0).sub(occ.mul(float(3.0))), float(0.0), float(1.0));
    return ao.mul(float(0.5).add(float(0.5).mul(nor.y)));
});



export const CamRayDir = Fn(() => {
    const viewPos = getViewPosition(screenUV, float(1), cameraProjectionMatrixInverse);
    return cameraWorldMatrix.mul(vec4(viewPos, 0.0)).xyz.normalize();
});


export const getSdfNormal = Fn(([sdf, position]: [any, any]) => {
    const e = vec2(0.001, 0);
    return normalize(
        vec3(
            sdf(position.add(e.xyy)).sub(sdf(position.sub(e.xyy))).x,
            sdf(position.add(e.yxy)).sub(sdf(position.sub(e.yxy))).x,
            sdf(position.add(e.yyx)).sub(sdf(position.sub(e.yyx))).x
        )
    );
});

export const raymarch = Fn(([sdfSceneFN]: [any]) => {
    const maxSteps = uniform(100);
    const surfaceDistance = uniform(1e-5)
    const maxDistance = uniform(100);

    const rayOrigin = cameraPosition;
    const rayDirection = CamRayDir();

    const accumulatedDistance = float(0).toVar()
    const distance = float(0).toVar("SDF_Distance")
    const position = vec3(0).toVar("SDF_WorldPos")
    const bg = bool(false).toVar("SDF_Bg_Hit")

    Loop({ start: 0, end: maxSteps }, () => {
        position.assign(rayOrigin.add(rayDirection.mul(accumulatedDistance)))
        distance.assign(sdfSceneFN(position).x)

        If(
            abs(distance).lessThan(surfaceDistance)
                .or(accumulatedDistance.greaterThan(maxDistance)),
            () => { Break() }
        )

        accumulatedDistance.addAssign(distance)
    })

    return position;
})



export function SdfBackgroundSimple() {
    const { scene } = useThree()
    useEffect(() => {
        
        const sdfScene = Fn(([position]: [any]) => {
            const sphere = shapes.sphere(position.sub(vec3(0, 1, -5)), 2)
            const distance = sphere.toVar()
            distance.assign(min(distance, position.y));
            return vec2(distance, 1);
        })

        const sun_dir = vec3(0.5, 0.4, 0);

        const P = raymarch(sdfScene);
        const N = getSdfNormal(sdfScene, P);
        const diffuse = calcDiffuse(N, sun_dir).mul(0.5);
        const ambient = calcAmbientLight(N);
        const shadow = calcSoftshadow(P, sun_dir, 0.01, 2.5, sdfScene);
        const ao = calcAO(P, N, sdfScene);
        //@ts-ignore
        scene.background = diffuse.mul(shadow).add(ambient).mul(0.5);


    }, [])
    return null;
}





/** REACT LIKE */
export class SdfSceneBuilder {
  objects: Array<(p: any) => any> = [];

  // generic push function
  add(fn: (p: any) => any) {
    this.objects.push(fn);
  }

  build() {
    return Fn(([p]: [any]) => {
      if (this.objects.length === 0) return vec2(float(1000), 0); // empty scene
      const dist = this.objects.map(fn => fn(p));
      return vec2(dist.reduce((a, b) => min(a, b)), 1);
    });
  }
}

// React Context
const SdfSceneContext = createContext<SdfSceneBuilder | null>(null);
export function useSdfScene() {
    const ctx = useContext(SdfSceneContext);
    if (!ctx) throw new Error("useSdfScene must be inside <SdfBackground>");
    return ctx;
}

type SdfObjectProps = { fn: (p: any) => any; };

export function SdfObject({ fn }: SdfObjectProps) {
  const builder = useSdfScene();
  useEffect(() => { builder.add(fn);  }, [builder, fn]);
  return null;
}

export function SdfSphere({ position, radius }: { position: any; radius: any }) {
  return <SdfObject fn={(p: any) => shapes.sphere(sub(p, position), radius)} />;
}

export function SdfPlane({ y }: { y: any }) {
  return <SdfObject fn={(p: any) => sub(p.y, y)} />;
}





export function SdfBackground({ children }: { children?: React.ReactNode }) {
    const { scene } = useThree();

    // Create a new SDF scene builder per frame
    const sdfSceneBuilder = useMemo(() => new SdfSceneBuilder(), []);

    // After all children have added themselves, render SDF background
    useEffect(() => {
        const sdfScene = sdfSceneBuilder.build();
        const sunDir = vec3(0.5, 0.4, 0);

        const P = raymarch(sdfScene);
        const N = getSdfNormal(sdfScene, P);
        const diffuse = calcDiffuse(N, sunDir).mul(0.5);
        const ambient = calcAmbientLight(N);
        const shadow = calcSoftshadow(P, sunDir, 0.01, 2.5, sdfScene);
        const ao = calcAO(P, N, sdfScene);

        //@ts-ignore
        scene.background = diffuse.mul(shadow).add(ambient).mul(0.5);
    }, [scene, sdfSceneBuilder]);

    return (
        <SdfSceneContext.Provider value={sdfSceneBuilder}>
            {children}
        </SdfSceneContext.Provider>
    );
}


export function TestSDF() {
    return <SdfBackground>
        <SdfSphere position={vec3(0, 1, -5)} radius={2} />
        <SdfSphere position={vec3(2, 1, -3)} radius={1} />
        <SdfPlane y={0} />
    </SdfBackground>;

}











