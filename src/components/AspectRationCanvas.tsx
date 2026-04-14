import { type PropsWithChildren } from "react";

export type AspectRatioCanvasProps = PropsWithChildren<{ aspectRatio?: string }>;

export default function AspectRatioCanvas({
  aspectRatio = "235 / 100",
  children,
}: AspectRatioCanvasProps) {
  return (
    <div
      style={{
        overflow: "hidden",
        position: "relative",
        background: "black",
      }}
    >
      <div
        id="CanvasParent"
        style={{
          position: "fixed",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          background: "black",
          overflow: "hidden",
          inset: 0,
        }}
      >
        <div
          id="Canvas3D"
          style={{
            width: "100%",
            height: "auto",
            aspectRatio: aspectRatio,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
