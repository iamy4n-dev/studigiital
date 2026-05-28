"use client";

import { useEffect } from "react";

export function XpToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [xp, onDone]);

  return (
    <div style={s.overlay}>
      <span style={s.badge}>+{xp} XP</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  badge: {
    fontSize: "1.5rem",
    fontWeight: 800,
    color: "#166534",
    background: "#dcfce7",
    border: "2px solid #bbf7d0",
    borderRadius: 12,
    padding: "0.5rem 1.25rem",
    letterSpacing: "-0.02em",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
};
