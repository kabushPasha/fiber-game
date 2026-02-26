import * as THREE from 'three/webgpu';
import { uv, Fn, vec4, positionWorld, cameraPosition, normalize, sub, greaterThan, If, pointUV } from 'three/tsl';
import { getViewPosition, cameraWorldMatrix, cameraProjectionMatrixInverse, max, exp2, mat2, Var, time, abs, clamp, array, cos, div, screenUV, sin, vec3, vec2, fract, floor, length, mul, add, step, mix, smoothstep, hash, dot, float, uvec3, uint, ivec3, Loop, pow } from 'three/tsl';

import * as TSL from 'three/tsl'
import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';

// creates a 2d rotatin matrix that rotates by a radians  float-mat2
export const mm2 = Fn(([a]: [any]) => {
    const c = cos(a);
    const s = sin(a);
    // @ts-ignore
    return mat2(c, s, s.negate(), c);
});
// precomputed rotation by 17 degrees
// @ts-ignore
export const m2 = mat2(float(0.95534), float(0.29552), float(-0.29552), float(0.95534));

// creates a tiangular wave 0-0.5 ^^^  float-float
export const tri = Fn(([x]: [any]) => {
    return clamp(
        abs(fract(x).sub(0.5)),
        0.01,
        0.49
    );
});
// 2s triangular pattern vec2-vec2
export const tri2 = Fn(([p]: [any]) => {
    const tx = tri(p.x);
    const ty = tri(p.y);

    return vec2(
        tx.add(ty),
        tri(p.y.add(tx))
    );
});

const nmzHash33 = /*@__PURE__*/ Fn(([q]: [any]) => {
    /*
    vec3 nmzHash33(vec3 q)
    {
        uvec3 p = uvec3(ivec3(q));
        p = p*uvec3(374761393U, 1103515245U, 668265263U) + p.zxy + p.yzx;
        p = p.yzx*(p.zxy^(p >> 3U));
        return vec3(p^(p >> 16U))*(1.0/vec3(0xffffffffU));
    }
    */

    // uvec3 p = uvec3(ivec3(q));
    let p = uvec3(ivec3(q));

    // p = p * constants + p.zxy + p.yzx
    p = p
        .mul(uvec3(374761393, 1103515245, 668265263))
        .add(p.zxy)
        .add(p.yzx);

    // p = p.yzx * (p.zxy ^ (p >> 3))
    p = p.yzx.mul(
        p.zxy.bitXor(
            p.shiftRight(uvec3(3))
        )
    );
    // return vec3(p^(p >> 16U))*(1.0/vec3(0xffffffffU));
    p = vec3(p.xyz.bitXor(p.shiftRight(uvec3(16))));
    return p.mul(1 / 0xffffffff);

});
const hash21 = Fn(([n]: [any]) => {
    //float hash21(in vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
    return fract(sin(dot(n, vec2(12.9898, 4.1414))).mul(43758.5453))
});


export const Stars = Fn(([p]: [any]) => {
    const res = 1024;
    const starLayer = Fn(([pos, i]: [any, any]) => {
        const p = vec3(pos.xyz);
        // vec3 q = fract(p*(.15*res))-0.5;
        const q = fract(p.mul(0.15).mul(res)).sub(0.5);
        //vec3 id = floor(p*(.15*res));
        const id = floor(p.mul(0.15).mul(res))
        //vec2 rn = nmzHash33(id).xy;
        const rn = nmzHash33(id).xy;
        //float c2 = 1.-smoothstep(0.,.6,length(q));
        let c2 = sub(1.0, smoothstep(0.0, 0.6, q.length()));
        //c2 *= step(rn.x,.0005+i*i*0.001);
        c2 = c2.mul(step(rn.x, add(0.0005, mul(i, i).mul(0.001))))
        //c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.1+0.9);
        const c = c2.mul(mix(vec3(1.0, 0.49, 0.1), vec3(0.75, 0.9, 1.), rn.y).mul(0.1).add(0.9))
        //p *= 1.3;
        return vec3(c);
    });

    const pos = vec3(p.xyz);
    let c = vec3(0, 0, 0);

    const count = 5;
    Loop(count, ({ i }) => {
        c.addAssign(starLayer(pos.mul(pow(1.3, i.toFloat())), i));
    })

    return mul(mul(c, c), 0.8);
});


export const triNoise2d = Fn(([pp, spd]: [any, any]) => {
    /*
    float triNoise2d(in vec2 p, float spd)
    {
        float z=1.8;
        float z2=2.5;
        float rz = 0.;
        p *= mm2(p.x*0.06);
        vec2 bp = p;
        for (float i=0.; i<5.; i++ )
        {
            vec2 dg = tri2(bp*1.85)*.75;
            dg *= mm2(time*spd);
            p -= dg/z2;

            bp *= 1.3;
            z2 *= .45;
            z *= .42;
            p *= 1.21 + (rz-1.0)*.02;
            
            rz += tri(p.x+tri(p.y))*z;
            p*= -m2;
        }
        return clamp(1./pow(rz*29., 1.3),0.,.55);
    }
    */
    const p: any = pp.toVar("triNoise_p");
    const z: any = float(1.8).toVar("triNoise_z");
    const z2: any = float(2.5).toVar("triNoise_z2");
    const rz: any = float(0.0).toVar("triNoise_rz");
    // p *= mm2(p.x * 0.06);
    p.assign(mm2(p.x.mul(0.06)).mul(p));

    const bp = p.toVar("triNoise_bp");
    Loop(5, () => {
        // vec2 dg = tri2(bp * 1.85) * .75;
        const dg = tri2(bp.mul(1.85)).mul(0.75);
        // dg *= mm2(time * spd);
        dg.assign(mm2(time.mul(spd)).mul(dg));
        // p -= dg / z2;
        p.assign(p.sub(dg.div(z2)));
        // bp *= 1.3;
        bp.assign(bp.mul(1.3));
        // z2 *= .45;
        z2.assign(z2.mul(0.45));
        // z *= .42;
        z.assign(z.mul(0.42));
        // p *= 1.21 + (rz - 1.0) * .02;
        p.assign(p.mul(float(1.21).add(rz.sub(1.0).mul(0.02))));
        // rz += tri(p.x + tri(p.y)) * z;
        rz.assign(rz.add(tri(p.x.add(tri(p.y))).mul(z)));
        // p *= -m2;
        p.assign(m2.mul(p).negate());
    });
    // return clamp(1. / pow(rz * 29., 1.3), 0., .55);    
    return clamp(float(1.0).div(pow(rz.mul(29.0).max(0.0001), 1.3)), 0.0, 0.55);
});

export const Aurora = Fn(([ro, ray_dir]: [any, any]) => {
    /*
    vec4 col = vec4(0);
    vec4 avgCol = vec4(0);
    
    for(float i=0.;i<50.;i++)
    {
        float of = 0.006*hash21(gl_FragCoord.xy)*smoothstep(0.,15., i);
        float pt = ((.8+pow(i,1.4)*.002)-ro.y)/(rd.y*2.+0.4);
        pt -= of;
        vec3 bpos = ro + pt*rd;
        vec2 p = bpos.zx;
        float rzt = triNoise2d(p, 0.06);
        vec4 col2 = vec4(0,0,0, rzt);
        col2.rgb = (sin(1.-vec3(2.15,-.5, 1.2)+i*0.043)*0.5+0.5)*rzt;
        avgCol =  mix(avgCol, col2, .5);
        col += avgCol*exp2(-i*0.065 - 2.5)*smoothstep(0.,5., i);    
    }
    
    col *= (clamp(rd.y*15.+.4,0.,1.));
    return col*1.8;    
    */
    const rd = vec3(ray_dir.x, abs(ray_dir.y), ray_dir.z);

    const col = vec4(0.0).toVar("Aurora_col");
    const avgCol = vec4(0.0).toVar("Aurora_avgCol");;
    const iter = 50;

    Loop(iter, ({ i }) => {
        // offset for randomness
        const of = float(0.006)
            .mul(hash21(screenUV.xy))
            .mul(smoothstep(0.0, 15.0, i));

        // distance along the ray
        const pt = div(
            float(0.8).add(pow(i, 1.4).mul(0.002)).sub(ro.y),
            rd.y.mul(2.0).add(0.4)
        ).sub(of);

        // 3D position along the ray
        const bpos = ro.add(pt.mul(rd));

        // sample position for noise
        const p = bpos.zx;
        const rzt = triNoise2d(p, 0.2);

        // create color with noise in alpha
        const col2 = vec4(
            vec3(1.0, 1.0, 1.0)
                .sub(vec3(2.15, -0.5, 1.2))
                .add(float(i).mul(0.043))
                .sin()
                .mul(0.5)
                .add(0.5)
                .mul(rzt)
            , rzt);

        // blend with average color
        avgCol.assign(mix(avgCol, col2, 0.5));

        // accumulate final color with exponential falloff
        col.assign(
            col.add(
                avgCol.mul(exp2(float(i.negate()).mul(0.065).sub(2.5))).mul(smoothstep(0.0, 5.0, i))
            )
        );
    });

    // final intensity scaling based on ray direction
    col.assign(col.mul(clamp(rd.y.mul(15.0).add(0.4), 0.0, 1.0)));

    // amplify slightly
    return col.mul(1.8);
});

export const Aurora_bg = Fn(([rd]: [any]) => {
    // normalized light/direction vector
    const n = vec3(-0.5, -0.6, 0.9).normalize();

    // compute dot product with ray direction
    const sd = n.dot(rd).mul(0.5).add(0.5);

    // raise to power 5
    const sdPow = pow(sd, 5.0);

    // mix two colors based on sdPow
    const col = mix(
        vec3(0.05, 0.1, 0.2),
        vec3(0.1, 0.05, 0.2),
        sdPow
    );

    // scale final color
    return col.mul(0.63);
});

export const addGroundNoise = Fn(([ro, rd]: [any, any]) => {
    // compute ground intersection point along ray   
    const t = div(ro.y.add(1.75).negate(), rd.y);
    const pos = ro.add(rd.mul(t)).toVar("ground_noise_pos");

    pos.mulAssign(0.75);
    // sample 2D triangular noise
    const nz2 = triNoise2d(pos.xz.mul(vec2(0.5, 0.7)), 0.0);

    // compute color contribution
    return mix(
        vec3(0.2, 0.25, 0.5).mul(0.08),
        vec3(0.3, 0.3, 0.5).mul(0.7),
        nz2.mul(0.4)
    );
});

export const CamRayDir = Fn(() => {
    const viewPos = getViewPosition(screenUV, float(1), cameraProjectionMatrixInverse);
    return cameraWorldMatrix.mul(vec4(viewPos, 0.0)).xyz.normalize();
});

export const AuroraMaterial = Fn(() => {
    const rayDir = CamRayDir();
    const aurora = Aurora(vec3(0), rayDir).toVar("aurora");
    const stars = Stars(rayDir).toVar("aurora_stars");
    const bg = Aurora_bg(rayDir);

    const fade = smoothstep(0., 0.01, abs(rayDir.y)).mul(0.1).add(0.9);

    If(rayDir.y.lessThan(0), () => {
        stars.assign(stars.mul(0.1));
        aurora.assign(smoothstep(0.0, 2.5, aurora).add(bg.mul(0.6)));
        aurora.addAssign(addGroundNoise(cameraPosition, rayDir).mul(2.5));
    }).Else(() => {
        aurora.assign(smoothstep(0.0, 1.5, aurora).add(bg));
    })

    return aurora.add(stars).mul(fade).pow(1).mul(0.5);
});

export function AuroraBackground() {
    const { scene } = useThree()
    useEffect(() => { scene.background = AuroraMaterial();  }, [])
    return null;
}




export function SimpleBackground() {
    const colorMap = useLoader(THREE.TextureLoader, "textures/hdri/clouds.jpg")
    colorMap.mapping = THREE.EquirectangularReflectionMapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;

    const { scene } = useThree()
    useEffect(() => { scene.background = colorMap;  }, [])
    return null;    
}