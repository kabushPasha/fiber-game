import { Sphere } from "@react-three/drei";
import { Pixelated } from "../../../components/Pixelated";
import { Player } from "../../Player/Player";
import { GroundClampSimple, Jump, MoveByVel } from "../../Player/PlayerPhysics";
import { SimpleBackground } from "../../shaders/Aurora";
import * as THREE from "three/webgpu"
import { io } from "socket.io-client";
import { useEffect } from "react";
import { usePlayer } from "../../Player/PlayerContext";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { PinesScatter } from "../../Terrain/ScatterAPI/Scatter/Presets";






export function MultiplayerTestLevel() {

    const socketRef = useRef<any>(null);
    const [players, setPlayers] = useState<Record<string, any>>({});


    useEffect(() => {
        const server_url = "https://subalate-evia-squelchingly.ngrok-free.dev"
        //const socket = io("http://localhost:3000");
        const socket = io(server_url, { transports: ["websocket"], });
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("connected", socket.id);
        });

        socket.on("playersUpdate", (serverPlayers) => {
            setPlayers(serverPlayers);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const player = usePlayer()
    useFrame(() => {
        if (!socketRef.current) return;
        const pos = player.playerWorldPosition;
        socketRef.current.emit("playerMove", [
            pos.x,
            pos.y,
            pos.z,
        ]);
    });



    return <>

        <Pixelated resolution={256} enabled={true} />

        <Player >
            {1 && <MoveByVel speed={0.5} />}
            <GroundClampSimple />
            <Jump />

        </Player>


        <SimpleBackground />
        <group name="Lights">
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 5, 0]} intensity={0.5} />
        </group>


        {1 && <>
            <mesh
                rotation={[-Math.PI * 0.5, 0, 0]}
                position={[0, 0, 0]}
                material={new THREE.MeshStandardMaterial()}
            >
                <planeGeometry args={[100, 100, 2, 2]} />
            </mesh>
        </>}

        {Object.values(players).map((p: any) => {
            if (p.id === socketRef.current?.id) return null;

            return (
                <Sphere key={p.id} position={p.position as [number, number, number]}>
                    <meshStandardMaterial color="orange" />
                </Sphere>
            );
        })}

    </>
}
