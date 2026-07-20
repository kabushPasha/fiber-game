import { Sphere } from "@react-three/drei";
import { Pixelated } from "../../../components/Pixelated";
import { useThree } from "@react-three/fiber";





export function TiledGrid2dTestLevel() {
    return <>

        <Pixelated resolution={128} enabled={true} />
        <ambientLight intensity={1.0} />




        <PlayerSphere />

        <gridHelper args={[15, 15]} scale={2}/>

       


    </>
}

export function PlayerSphere() {
    const { camera } = useThree()

    return (
        <>


            <group  rotation={[-Math.PI*0.25,0,0]}>
                <primitive object={camera} position={[0,0,20]}/>
            </group>
            <Sphere scale={0.5} />




        </>
    )
}





