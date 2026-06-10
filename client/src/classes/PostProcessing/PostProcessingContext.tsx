import { createContext, useContext, useRef, useMemo, type ReactNode, useEffect } from "react";
import * as THREE from "three/webgpu";
import { useThree, useFrame } from "@react-three/fiber";
import { pass, mrt, output, metalness, emissive, normalView, directionToColor, velocity, sample, colorToDirection } from "three/tsl";



export type PrePassData = {
    prePass: THREE.PassNode;
    prePassNormal: THREE.Node;
    prePassDepth: THREE.TextureNode;
    prePassVelocity: THREE.TextureNode;
};

interface WebGPUPostProcessingContextValue {
    postProcessing: THREE.PostProcessing | null;
    scenePass: THREE.PassNode | null;
    effectsRef: ((currentNode: any) => any)[]
    runEffects: () => void;
    prePassData: PrePassData | null;
}

const WebGPUPostProcessingContext = createContext<WebGPUPostProcessingContextValue | null>(null);

export function useWebGPUPostProcessing() {
    const context = useContext(WebGPUPostProcessingContext);
    if (!context) throw new Error(
        "useWebGPUPostProcessing must be used inside WebGPUPostProcessingProvider"
    );
    return context;
}

interface Props { children?: ReactNode }

export function WebGPUPostProcessingProvider({ children }: Props) {
    const { gl: renderer, scene, camera } = useThree();
    const postProcessingRef = useRef<THREE.PostProcessing | null>(null);
    const scenePassRef = useRef<THREE.PassNode | null>(null);
    const prePassRef = useRef<PrePassData | null>(null);

    // Registry of mounted effects
    const effectsRef = useRef<((currentNode: any) => any)[]>([]);


    // Rebuild the chain by running all mounted effects in order
    const runEffects = () => {
        //console.log("RUN EFECTS",effectsRef.current);
        if (!scenePassRef.current) return;

        if (postProcessingRef.current) { postProcessingRef.current.dispose(); }
        // @ts-ignore        
        postProcessingRef.current = new THREE.PostProcessing(renderer);

        postProcessingRef.current.outputNode = scenePassRef.current.getTextureNode("output"); // reset
        effectsRef.current.forEach(effect => {
            //console.log("APPLIED EFFECT");
            const node = effect(postProcessingRef.current!.outputNode);
            if (node) postProcessingRef.current!.outputNode = node;
        });
    };

    // Setup postprocessing and scenePass
    useEffect(() => {
        //console.log("CREATE PP")
        //console.log("CAM CHANGED", camera);
        if (!renderer || !scene || !camera) return;

        // Main Pass
        const scenePass = pass(scene, camera, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });

        scenePass.setMRT(
            mrt({
                output: output,
                normal: normalView,
                metalness: metalness,
                emissive: emissive,
            })
        );

        // Pre Pass
        const prePass = pass(scene, camera)
        prePass.name = 'Pre-Pass';
        prePass.transparent = false;
        prePass.setMRT(mrt({
            output: directionToColor(normalView),
            velocity: velocity
        }));
        const prePassNormal = sample((uv) => {
            return colorToDirection(prePass.getTextureNode().sample(uv));
        });
        const prePassDepth = prePass.getTextureNode('depth').toInspector('Depth', () => prePass.getLinearDepthNode());
        const prePassVelocity = prePass.getTextureNode('velocity').toInspector('Velocity');
        const normalTexture = prePass.getTexture('output');
        normalTexture.type = THREE.UnsignedByteType;
        const prePassData: PrePassData = {
            prePass,
            prePassNormal,
            prePassDepth,
            prePassVelocity
        };
        prePassRef.current = prePassData;


        // PostProcessing setup
        // @ts-ignore
        const postProcessing = new THREE.PostProcessing(renderer);
        postProcessing.outputNode = scenePass.getTextureNode("output");

        postProcessingRef.current = postProcessing;
        scenePassRef.current = scenePass;

        return () => {
            postProcessingRef.current = null;
            scenePassRef.current = null;
            effectsRef.current = [];
        };
    }, [renderer, scene]);



    // Render each frame
    useFrame(({ gl }) => {
        if (scenePassRef.current) { scenePassRef.current.camera = camera; }

        if (postProcessingRef.current) {
            gl.clear();
            postProcessingRef.current.render();
        }
    }, 1);

    const value = useMemo(() => ({
        postProcessing: postProcessingRef.current,
        scenePass: scenePassRef.current,
        prePassData: prePassRef.current,
        effectsRef: effectsRef.current,
        runEffects
    }), [postProcessingRef.current, scenePassRef.current]);

    return (
        <WebGPUPostProcessingContext.Provider value={value}>
            {children}
        </WebGPUPostProcessingContext.Provider>
    );
}

// Generic Effect ----------------------------------------------------
// Generic effect that uses the current outputNode
export function PostProcessingEffect(effectFn: (currentNode: any) => any) {
    const { effectsRef, runEffects } = useWebGPUPostProcessing();

    const id = useRef<number | null>(null);

    useEffect(() => {
        if (id.current === null) {
            id.current = effectsRef.length;
            effectsRef.push(() => { });
        }

        return () => {
            if (id.current) effectsRef[id.current] = () => { };
        }
    }, [])


    useEffect(() => {
        if (id.current === null) {
            id.current = effectsRef.length;
            effectsRef.push(effectFn);
        }
        else {
            effectsRef[id.current] = effectFn;
        }
        runEffects();

    }, [effectFn]);
}


// EFFECTS Implementations -------------------------------

export function NormalView() {
    const { scenePass } = useWebGPUPostProcessing();

    PostProcessingEffect(() => {
        if (!scenePass) return null;
        return scenePass.getTextureNode("normal");
    });

    return null;
}

export function Desaturate() {
    PostProcessingEffect((inputNode) => {
        if (!inputNode) return null;
        return inputNode.zzz;
    });

    return null;
}

