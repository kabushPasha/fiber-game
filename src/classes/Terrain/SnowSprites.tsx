import { folder, useControls } from "leva";
import { useMemo } from "react";
import {
    add,
    cameraPosition,
    clamp,
    div,
    Fn,
    instancedBufferAttribute,
    length,
    mix,
    mod,
    mul,
    sub,
    time,
    uniform,
    vec3
} from "three/tsl";
import * as THREE from "three/webgpu";

export type SnowSpriteProps = {
    active?: boolean;
    count?: number;
    areaSize?: number;
    height?: number;
    fallSpeed?: number;
    size?: number;
    showControls?: boolean; // <-- new prop
};

export function SnowSpritesUI(props: SnowSpriteProps) {    

    if (!props.showControls) {
        return <SnowSprites {...props} />;
    }

    const controls = useControls("Effects", {
        Snow: folder(
            {
                active: { value: props.active ?? true },

                count: {
                    value: props.count ?? 2000,
                    min: 100,
                    max: 20000,
                    step: 100
                },

                areaSize: {
                    value: props.areaSize ?? 50,
                    min: 10,
                    max: 200,
                    step: 1
                },

                height: {
                    value: props.height ?? 20,
                    min: 5,
                    max: 100,
                    step: 1
                },

                fallSpeed: {
                    value: props.fallSpeed ?? 1,
                    min: 0,
                    max: 5,
                    step: 0.1
                },

                size: {
                    value: props.size ?? 0.05,
                    min: 0.01,
                    max: 2,
                    step: 0.01
                }
            },
            { collapsed: true }
        )
    });

    return <SnowSprites {...controls} />;
}

export function SnowSprites({
    active = true,
    count = 2000,
    areaSize = 50,
    height = 20,
    fallSpeed = 1,
    size = 0.05,
}: SnowSpriteProps) {

    // Create Positions
    const positionAttribute = useMemo(() => {
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * areaSize;
            positions[i * 3 + 1] = Math.random() * height;
            positions[i * 3 + 2] = (Math.random() - 0.5) * areaSize;
        }

        return new THREE.InstancedBufferAttribute(positions, 3);
    }, [count, areaSize, height]);

    const sprite = useMemo(() => {

        const material = new THREE.SpriteNodeMaterial({
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const position = instancedBufferAttribute(positionAttribute);

        const fallSpeedUniform = uniform(fallSpeed);
        const heightUniform = uniform(height);
        const areaSizeUniform = uniform(areaSize);

        // Falling
        const fallenPosition = vec3(
            position.x,
            mod(position.y.sub(mul(time, fallSpeedUniform)), heightUniform),
            position.z
        );

        // Camera wrapping
        const cameraWrapFn = Fn((args: { position: any; areaSize: any }) => {
            const { position, areaSize } = args;
            const halfArea = areaSize.mul(0.5);

            return add(
                cameraPosition,
                sub(
                    mod(
                        add(sub(position, cameraPosition), halfArea),
                        areaSize
                    ),
                    halfArea
                )
            );
        });

        const wrapped_position = cameraWrapFn({
            position: fallenPosition,
            areaSize: areaSizeUniform
        });

        material.positionNode = wrapped_position;

        // Height opacity
        const maxHeight = uniform(height);
        const minOpacity = uniform(0);
        const maxOpacity = uniform(1);

        const heightFactor = div(position.y, maxHeight);
        const heightOpacity = mix(maxOpacity, minOpacity, heightFactor);

        // Distance opacity
        const dist = length(sub(wrapped_position, cameraPosition));
        const maxDistance = areaSizeUniform.mul(0.5);

        const distanceOpacity = clamp(
            div(sub(maxDistance, dist), maxDistance),
            0,
            1
        );

        material.opacityNode = heightOpacity.mul(distanceOpacity);
        material.scaleNode = uniform(size);

        const sprite = new THREE.Sprite(material);
        sprite.count = count;
        sprite.frustumCulled = false;

        return sprite;

    }, [positionAttribute, fallSpeed, height, areaSize, size, count]);

    return active ? <primitive object={sprite} /> : null;
}