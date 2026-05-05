import { useState } from "react";
import { Rnd } from "react-rnd";
import { PaletteEditor } from "./PaletterEditor";


type Props = {
  onPaletteChanged?: (palette: string[]) => void;
  onClose?: () => void;
};

export function FloatingPalette({
  onPaletteChanged,
  onClose,
}: Props) {
  const [palette, setPalette] = useState<string[]>([
    "#000000",
    "#ffffff",
  ]);

  const handleChange = (next: string[]) => {
    setPalette(next);
    onPaletteChanged?.(next); // 🔥 external hook
  };

  const handleClose = () => {
    onClose?.(); // 🔥 external hook
  };

  return (
    <Rnd
      default={{ x: 20, y: 20, width: 360, height: "auto" }}
      minWidth={260}
      bounds="window"
    >
      <div
        style={{
          background: "#111",
          borderRadius: 10,
          overflow: "hidden",
          color: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 10px",
            background: "#1e1e1e",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            PaletteGenerator
          </span>

          <div style={{ display: "flex", gap: 6 }}>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: 12 }}>
          <PaletteEditor
            palette={palette}
            onChange={handleChange}
          />
        </div>
      </div>
    </Rnd>
  );
}