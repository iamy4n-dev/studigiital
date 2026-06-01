"use client";

import { useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { XpToast } from "@/components/XpToast";
import { ArtifactCard } from "@/components/DrillCards";
import type { DrillItem } from "@/components/DrillCards";


interface QueueResponse {
  items: DrillItem[];
  new_count: number;
  reviewed_count: number;
}

export type QueueMode = "structured" | "random";

export interface DrillConfig {
  tags: string[];
  mode: QueueMode;
}

export function DrillView({
  getToken,
  config,
  onExit,
}: {
  getToken: () => Promise<string | null>;
  config: DrillConfig;
  onExit: () => void;
}) {
  const [originalQueue, setOriginalQueue] = useState<DrillItem[]>([]);
  const [activeQueue, setActiveQueue] = useState<DrillItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);
  const [weakSpots, setWeakSpots] = useState<Set<string>>(new Set());
  const [drillPhase, setDrillPhase] = useState<"drilling" | "complete">("drilling");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{ outcome: "passed" | "failed"; xp: number | null } | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        tokenRef.current = token;
        const params = new URLSearchParams({
          tags: config.tags.join(","),
          mode: config.mode,
        });
        const res = await fetch(`/api/v1/review/queue?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data: QueueResponse = await res.json();
        setOriginalQueue(data.items);
        setActiveQueue(data.items);
        setTotalCount(data.items.length);
      } catch {
        setError("Could not load drill queue");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken, config]);

  async function recordEvent(itemId: string, outcome: "passed" | "failed"): Promise<number> {
    const token = tokenRef.current;
    try {
      const res = await fetch(`/api/v1/review/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ item_id: itemId, outcome }),
      });
      if (!res.ok) return 0;
      const data: { id: string; xp_gained: number } = await res.json();
      return data.xp_gained;
    } catch {
      return 0;
    }
  }

  function rate(outcome: "passed" | "failed") {
    const current = activeQueue[0];
    if (!current) return;
    if (outcome === "failed") {
      setWeakSpots((prev) => new Set([...prev, current.id]));
    }
    setToastState({ outcome, xp: null });
    recordEvent(current.id, outcome).then((xp) => {
      setToastState((prev) => prev ? { outcome, xp } : null);
    });
  }

  function next(outcome: "passed" | "failed") {
    const [current, ...rest] = activeQueue;
    if (!current) return;
    setToastState(null);
    setCardKey((k) => k + 1);
    if (outcome === "passed") {
      setLearnedCount((c) => c + 1);
      if (rest.length === 0) {
        setDrillPhase("complete");
      } else {
        setActiveQueue(rest);
      }
    } else {
      setActiveQueue([...rest, current]);
    }
  }

  function handleRetry() {
    const retryQueue = originalQueue.filter((a) => weakSpots.has(a.id));
    setActiveQueue(retryQueue);
    setTotalCount(retryQueue.length);
    setLearnedCount(0);
    setWeakSpots(new Set());
    setDrillPhase("drilling");
  }

  if (loading) {
    return (
      <div style={s.shell}>
        <AppNav active="review" />
        <main style={s.main}><p style={{ color: "#888" }}>Loading…</p></main>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.shell}>
        <AppNav active="review" />
        <main style={s.main}><p style={{ color: "#c00" }}>{error}</p></main>
      </div>
    );
  }

  if (originalQueue.length === 0) {
    return (
      <div style={s.shell}>
        <AppNav active="review" />
        <main style={s.main}>
          <p style={{ color: "#666" }}>No artifacts found for the selected topics.</p>
          <button type="button" style={s.exitBtn} onClick={onExit}>← Change topics</button>
        </main>
      </div>
    );
  }

  if (drillPhase === "complete") {
    return (
      <div style={s.shell}>
        <AppNav active="review" />
        <main style={s.main}>
          <CompletionScreen
            totalCount={totalCount}
            weakSpotCount={weakSpots.size}
            onRetry={weakSpots.size > 0 ? handleRetry : undefined}
            onExit={onExit}
          />
        </main>
      </div>
    );
  }

  const artifact = activeQueue[0]!;

  return (
    <div style={s.shell}>
      <AppNav active="review" />
      <main style={s.main}>
        <div style={s.drillHeader}>
          <button type="button" style={s.exitBtn} onClick={onExit}>← Exit</button>
          <span style={s.progress}>{learnedCount} / {totalCount} learned</span>
        </div>
        <ArtifactCard key={cardKey} item={artifact} onRate={rate} onNext={next} />
      </main>
      {toastState && <XpToast outcome={toastState.outcome} xp={toastState.xp} onDone={() => setToastState(null)} />}
    </div>
  );
}

function CompletionScreen({
  totalCount,
  weakSpotCount,
  onRetry,
  onExit,
}: {
  totalCount: number;
  weakSpotCount: number;
  onRetry?: () => void;
  onExit: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={s.card}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          All {totalCount} artifact{totalCount !== 1 ? "s" : ""} learned
        </h2>
        {weakSpotCount > 0 ? (
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9375rem" }}>
            {weakSpotCount} took multiple tries.
          </p>
        ) : (
          <p style={{ margin: 0, color: "#166534", fontSize: "0.9375rem" }}>
            Perfect run — no weak spots.
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          style={{ ...s.startBtn, background: "#1a1a1a" }}
          onClick={onRetry}
        >
          Retry weak spots ({weakSpotCount})
        </button>
      )}
      <button
        type="button"
        style={{ ...s.startBtn, background: "#f3f4f6", color: "#374151" }}
        onClick={onExit}
      >
        Exit drill
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fafafa" },
  main: { flex: 1, maxWidth: 600, width: "100%", margin: "0 auto", padding: "2rem 1rem" },
  card: {
    background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12,
    padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem",
  },
  startBtn: {
    width: "100%", padding: "0.75rem", borderRadius: 10, border: "none",
    background: "#1a1a1a", color: "#fff", fontSize: "1rem", fontWeight: 700,
  },
  drillHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  exitBtn: { background: "none", border: "none", color: "#6b7280", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", padding: 0 },
  progress: { fontSize: "0.875rem", color: "#9ca3af", fontWeight: 500 },
};
