import { useEffect } from "react";
import { Pixelated } from "../../../components/Pixelated";
import { ImmortalLeva } from "../../LEVELS/Assets/Characters/Knight";
import { useMouseLock } from "../../Player/MouseLock";
import { Player } from "../../Player/Player";
import { GroundClamp, MoveByVel } from "../../Player/PlayerPhysics";
import { TerrainProvider } from "../../Terrain/TerrainProvider";
import { RingBufferTest } from "./RingBuffer";
import { TexturedTerrain, VatCharacterScatter } from "./VatCrowds_Level";




export function VatCrowds_LevelGame() {


    return <>

        <Pixelated resolution={512} enabled={true} />


        <TerrainProvider textureUrl="textures/HFs/height.png" hf_height={0}>

            <Player camera_props={{ defaultZ: 40, default_pitch: 45, default_yaw: 180, head_y: 2.75 }} show_sphere={false}>
                
                <MoveByVel speed={0.5} />
                <GroundClamp />
                <ImmortalLeva />
            </Player>

            {/** <Vat_Character />*/}
            {1 && <VatCharacterScatter />}


            {/** <Vat_Character />*/}
            {1 && <TexturedTerrain />}

            {0 && <RingBufferTest />}

        </TerrainProvider>
    </>
}
