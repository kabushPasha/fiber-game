import { useEffect, useState } from "react";

export function LoadingScreen({ loading }: { loading: boolean }) {
  const [visible, setVisible] = useState(loading);

  // Fade-out handler
  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(() => setVisible(false), 500); // fade out
      return () => clearTimeout(timeout);
    } else {
      setVisible(true);
    }
  }, [loading]);

  if (!visible) return null;


  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "grey",
        fontSize: "2rem",
        fontFamily: "sans-serif",
        opacity: loading ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: "none",
        zIndex: 9999,
        whiteSpace: "pre",
        gap: "1rem", // space between spinner and text
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: "1rem",
          height: "1rem",
          border: "4px solid grey",
          borderTop: "4px solid transparent",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />

      {/* Loading text with animated dots */}
      <div>Loading</div>

      {/* Spinner animation keyframes */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}