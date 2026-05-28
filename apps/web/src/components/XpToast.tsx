"use client";

interface XpToastProps {
  outcome: "passed" | "failed";
  xp: number | null; // null = pending (backend hasn't responded yet)
  onDone: () => void;
}

export function XpToast({ outcome, xp, onDone }: XpToastProps) {
  const earned = outcome === "passed" && xp !== null && xp > 0;
  const mastered = outcome === "passed" && xp !== null && xp === 0;
  const failed = outcome === "failed";

  const bg = earned ? "#dcfce7" : mastered ? "#f0fdf4" : failed ? "#f3f4f6" : "#f0fdf4";
  const border = earned ? "#bbf7d0" : mastered ? "#d1fae5" : failed ? "#e5e7eb" : "#d1fae5";
  const color = earned ? "#166534" : mastered ? "#4b7c5c" : failed ? "#6b7280" : "#4b7c5c";

  const message = failed
    ? "Keep going — you'll get it!"
    : mastered
    ? "Already mastered!"
    : "Good job!";

  return (
    <div style={s.overlay}>
      <div style={{ ...s.badge, background: bg, border: `2px solid ${border}`, color }}>
        {earned && <span style={s.xpAmount}>+{xp} XP</span>}
        <span style={s.message}>{message}</span>
        <button type="button" style={{ ...s.dismiss, color }} onClick={onDone}>✕</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    bottom: "2rem",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 100,
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: 12,
    padding: "0.625rem 1.25rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    pointerEvents: "auto",
  },
  xpAmount: {
    fontSize: "1.25rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  message: {
    fontSize: "0.9375rem",
    fontWeight: 600,
  },
  dismiss: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "0.75rem",
    padding: "0 0 0 0.25rem",
    opacity: 0.6,
  },
};
