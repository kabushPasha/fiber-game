import React from "react"

type CrosshairDotProps = {
  size?: number   // diameter in pixels
  color?: string  // fill color
  opacity?: number // 0 to 1
}

export const CrosshairDot: React.FC<CrosshairDotProps> = ({
  size = 10,
  color = "white",
  opacity = 1,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: color,
        opacity: opacity,
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  )
}
