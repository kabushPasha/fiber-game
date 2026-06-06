import { useEffect } from "react";
import { useUI } from "../../../../components/UIScreenContext";
import { useHordeStore } from "./PlayerStore_Horde";
import { ProgressBar } from "react-bootstrap";



export function PlayerHP_UI() {
    const ui = useUI();

    useEffect(() => {
        const unmount = ui.mount(() => <PlayerHPContent />);
        console.log("Mount UI");
        return unmount;
    }, [ui]);

    return null;
}

function PlayerHPContent() {
    const hp = useHordeStore((s) => s.hp);

    return (
        <div
            style={{
                position: "absolute",
                bottom: 25,
                left: 25,
                zIndex: 9999,
                color: "#ff3e3e",
                width: "50%",
            }}
        >
            <ProgressBar
                now={hp}
                label={hp.toFixed(1)}
                variant="danger"
            />
        </div>
    );
}