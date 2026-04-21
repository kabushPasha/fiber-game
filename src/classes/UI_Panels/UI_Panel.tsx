import {  useEffect, useState } from "react";
import { useMouseLock } from "../Player/MouseLock";
import { useUI } from "../../components/UIScreenContext";



type UI_PanelProps = React.PropsWithChildren & {
    defaultVisible?: boolean;
};

export function UI_Panel({ children, defaultVisible = false }: UI_PanelProps) {
    const [visible, setVisible] = useState(defaultVisible);

    const mouseLock = useMouseLock();

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "l" || e.key == "д") {
                setVisible(!visible)
                if (!visible) mouseLock.unlock();
                else mouseLock.lock();
            };
        }


        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [visible])

    const { mount } = useUI()

    useEffect(() => {
        const unmount = mount(() => {
            if (!visible) return null;
            return <div
                style={{
                    position: "absolute",
                    top: 75,
                    left: 25,
                    //width: "50vw",
                    //height: "50vh",
                    backgroundColor: "#3f3f3f8d",
                    zIndex: 9999,
                }}
            >
                <div className="d-grid gap-2">
                    {children}
                </div>
            </div>

        })
        return unmount
    }, [visible])

    return null;
}


