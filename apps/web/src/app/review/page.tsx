"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { DrillView } from "@/components/DrillView";
import type { DrillConfig, QueueMode } from "@/components/DrillView";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";
const LS_KEY = "studigital:last_drill_config";

interface TagOut {
  name: string;
  bg: string;
  text: string;
}

export default function ReviewPage() {
  return DEV_MODE ? <ReviewShell getToken={async () => null} /> : <AuthReview />;
}

function AuthReview() {
  const { getToken } = useAuth();
  return <ReviewShell getToken={getToken} />;
}

function ReviewShell({ getToken }: { getToken: () => Promise<string | null> }) {
  const [phase, setPhase] = useState<"setup" | "drill">("setup");
  const [config, setConfig] = useState<DrillConfig>({ tags: [], mode: "structured" });

  function startDrill(cfg: DrillConfig) {
    setConfig(cfg);
    setPhase("drill");
  }

  if (phase === "setup") {
    return <DrillSetup getToken={getToken} onStart={startDrill} />;
  }
  return <DrillView getToken={getToken} config={config} onExit={() => setPhase("setup")} />;
}

// ---------------------------------------------------------------------------
// Setup screen
// ---------------------------------------------------------------------------

function DrillSetup({
  getToken,
  onStart,
}: {
  getToken: () => Promise<string | null>;
  onStart: (cfg: DrillConfig) => void;
}) {
  const [tags, setTags] = useState<TagOut[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<QueueMode>("structured");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        const cfg: DrillConfig = JSON.parse(saved);
        setSelected(new Set(cfg.tags));
        setMode(cfg.mode);
      } catch {
        // ignore stale cache
      }
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`/api/v1/tags/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        setTags(await res.json());
      } catch {
        setError("Could not load tags");
      }
    }
    load();
  }, [getToken]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function handleStart() {
    const cfg: DrillConfig = { tags: [...selected], mode };
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    onStart(cfg);
  }

  const visible = tags.filter((t) =>
    filter ? t.name.toLowerCase().includes(filter.toLowerCase()) : true
  );

  return (
    <div style={s.shell}>
      <AppNav active="review" />
      <main style={s.main}>
        <h1 style={s.heading}>Start a Drill</h1>

        {error && <p style={{ color: "#c00" }}>{error}</p>}

        <label style={s.label}>Filter topics</label>
        <input
          style={s.filterInput}
          placeholder="Type to filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div style={s.chipGrid}>
          {visible.map((t) => {
            const isSelected = selected.has(t.name);
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => toggle(t.name)}
                style={{
                  ...s.chip,
                  background: isSelected ? t.bg : "#f3f4f6",
                  color: isSelected ? t.text : "#6b7280",
                  border: isSelected ? `1.5px solid ${t.text}` : "1.5px solid #e5e7eb",
                  fontWeight: isSelected ? 700 : 500,
                }}
              >
                {t.name}
              </button>
            );
          })}
          {visible.length === 0 && tags.length > 0 && (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No tags match</p>
          )}
          {tags.length === 0 && !error && (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              No tags yet — save some artifacts first
            </p>
          )}
        </div>

        <div style={s.modeRow}>
          <span style={s.label}>Queue order</span>
          <div style={s.modeToggle}>
            {(["structured", "random"] as QueueMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  ...s.modeBtn,
                  background: mode === m ? "#1a1a1a" : "#fff",
                  color: mode === m ? "#fff" : "#6b7280",
                }}
              >
                {m === "structured" ? "Structured" : "Random"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          style={{
            ...s.startBtn,
            opacity: selected.size === 0 ? 0.4 : 1,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
          }}
          disabled={selected.size === 0}
          onClick={handleStart}
        >
          {selected.size === 0 ? "Select at least one topic" : `Start Drill (${selected.size} topic${selected.size !== 1 ? "s" : ""})`}
        </button>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fafafa" },
  main: { flex: 1, maxWidth: 600, width: "100%", margin: "0 auto", padding: "2rem 1rem" },
  heading: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1.5rem" },
  label: { display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" },
  filterInput: {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1.5px solid #e5e7eb",
    fontSize: "0.9375rem", marginBottom: "1rem", boxSizing: "border-box",
  },
  chipGrid: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" },
  chip: {
    padding: "0.3rem 0.75rem", borderRadius: 999, fontSize: "0.875rem",
    cursor: "pointer", transition: "all 0.1s",
  },
  modeRow: { marginBottom: "1.5rem" },
  modeToggle: { display: "flex", borderRadius: 8, border: "1.5px solid #e5e7eb", overflow: "hidden", width: "fit-content" },
  modeBtn: {
    padding: "0.4rem 1rem", fontSize: "0.875rem", fontWeight: 600, border: "none", cursor: "pointer",
  },
  startBtn: {
    width: "100%", padding: "0.75rem", borderRadius: 10, border: "none",
    background: "#1a1a1a", color: "#fff", fontSize: "1rem", fontWeight: 700,
  },
};
