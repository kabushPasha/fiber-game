import { useEffect } from "react"
import { useUI } from "../../../components/UIScreenContext"
import { CrosshairDot } from "../../../components/CrosshairDot"




export function CrosshairComponent() {
    const { mount } = useUI()

    useEffect(() => {
        const unmount = mount(() => (
            <>
                <CrosshairDot
                    size={6}
                    color="white"
                    opacity={0.5}
                />

                <div
                    style={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        padding: "10px",
                        color: "#ffffff9a",
                        fontSize: "24px",
                        zIndex: 1000,
                    }}
                >
                    Controls:
                    <br />
                    WASD - Move
                    <br />
                    SHIFT - Sprint
                    <br />
                    MouseScroll - Zoom IN/OUT
                    <br />
                    L - Select Level
                    <br />
                    F - Change Camera(if availible)
                    <br />
                </div>
            </>
        ))

        return unmount
    }, [mount])

    return null
}