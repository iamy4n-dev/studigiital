"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MarkdownContent } from "@/lib/MarkdownContent";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";
const LS_KEY = "studigital:last_drill_config";

interface TagOut {
  name: string;
  bg: string;
  text: string;
}

interface ArtifactItem {
  id: string;
  artifact_type: string;
  content: Record<string, unknown>;
  tags: string[];
  source_text: string;
}

interface QueueResponse {
  artifacts: ArtifactItem[];
  new_count: number;
  reviewed_count: number;
}

type QueueMode = "structured" | "random";

interface DrillConfig {
  tags: string[];
  mode: QueueMode;
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
        const res = await fetch(`${API_URL}/api/v1/tags/`, {
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
      <Header active="review" />
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
// Drill view
// ---------------------------------------------------------------------------

function DrillView({
  getToken,
  config,
  onExit,
}: {
  getToken: () => Promise<string | null>;
  config: DrillConfig;
  onExit: () => void;
}) {
  const [queue, setQueue] = useState<ArtifactItem[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [doneThisRun, setDoneThisRun] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const res = await fetch(`${API_URL}/api/v1/review/queue?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data: QueueResponse = await res.json();
        setQueue(data.artifacts);
        setNewCount(data.new_count);
        setReviewedCount(data.reviewed_count);
      } catch {
        setError("Could not load drill queue");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken, config]);

  async function recordEvent(artifactId: string, outcome: "passed" | "failed") {
    const token = tokenRef.current;
    await fetch(`${API_URL}/api/v1/review/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ artifact_id: artifactId, outcome }),
    });
  }

  function advance(outcome: "passed" | "failed") {
    const artifact = queue[cursor % queue.length];
    if (artifact) recordEvent(artifact.id, outcome);
    setDoneThisRun((n) => n + 1);
    setCursor((c) => c + 1);
    if (newCount > 0) setNewCount((n) => Math.max(0, n - 1));
  }

  if (loading) {
    return (
      <div style={s.shell}>
        <Header active="review" />
        <main style={s.main}><p style={{ color: "#888" }}>Loading…</p></main>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.shell}>
        <Header active="review" />
        <main style={s.main}><p style={{ color: "#c00" }}>{error}</p></main>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div style={s.shell}>
        <Header active="review" />
        <main style={s.main}>
          <p style={{ color: "#666" }}>No artifacts found for the selected topics.</p>
          <button type="button" style={s.exitBtn} onClick={onExit}>← Change topics</button>
        </main>
      </div>
    );
  }

  const artifact = queue[cursor % queue.length]!;

  return (
    <div style={s.shell}>
      <Header active="review" />
      <main style={s.main}>
        <div style={s.drillHeader}>
          <button type="button" style={s.exitBtn} onClick={onExit}>← Exit</button>
          <span style={s.progress}>{doneThisRun} reviewed · {newCount} new</span>
        </div>
        <ArtifactCard artifact={artifact} onRate={advance} />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact card per type
// ---------------------------------------------------------------------------

function ArtifactCard({
  artifact,
  onRate,
}: {
  artifact: ArtifactItem;
  onRate: (outcome: "passed" | "failed") => void;
}) {
  if (artifact.artifact_type === "generate_flashcard") {
    return <FlashcardCard artifact={artifact} onRate={onRate} />;
  }
  if (artifact.artifact_type === "generate_quiz") {
    return <QuizCard artifact={artifact} onRate={onRate} />;
  }
  return <NoteCard artifact={artifact} onRate={onRate} />;
}

function FlashcardCard({
  artifact,
  onRate,
}: {
  artifact: ArtifactItem;
  onRate: (outcome: "passed" | "failed") => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const cards = artifact.content.cards as Array<{ front: string; back: string }> | undefined;
  const card = cards?.[0];

  // reset flip when artifact changes
  const artifactId = artifact.id;
  useEffect(() => setFlipped(false), [artifactId]);

  if (!card) return null;

  return (
    <div style={s.card}>
      <span style={s.typeBadge}>Flashcard</span>
      <p style={s.cardBody}>{flipped ? card.back : card.front}</p>
      {!flipped ? (
        <button type="button" style={s.flipBtn} onClick={() => setFlipped(true)}>
          Reveal answer
        </button>
      ) : (
        <div style={s.rateRow}>
          <button type="button" style={{ ...s.rateBtn, background: "#dcfce7", color: "#166534" }} onClick={() => onRate("passed")}>
            Got it
          </button>
          <button type="button" style={{ ...s.rateBtn, background: "#fee2e2", color: "#991b1b" }} onClick={() => onRate("failed")}>
            Not yet
          </button>
        </div>
      )}
    </div>
  );
}

function QuizCard({
  artifact,
  onRate,
}: {
  artifact: ArtifactItem;
  onRate: (outcome: "passed" | "failed") => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const questions = artifact.content.questions as Array<{
    stem: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }> | undefined;
  const q = questions?.[0];

  const artifactId = artifact.id;
  useEffect(() => setSelected(null), [artifactId]);

  if (!q) return null;

  const answered = selected !== null;
  const correct = selected === q.correct_index;

  return (
    <div style={s.card}>
      <span style={s.typeBadge}>Quiz</span>
      <p style={s.cardBody}>{q.stem}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        {q.options.map((opt, i) => {
          let bg = "#f9fafb";
          let border = "#e5e7eb";
          if (answered) {
            if (i === q.correct_index) { bg = "#dcfce7"; border = "#166534"; }
            else if (i === selected) { bg = "#fee2e2"; border = "#991b1b"; }
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => {
                setSelected(i);
                setTimeout(() => onRate(i === q.correct_index ? "passed" : "failed"), 800);
              }}
              style={{
                padding: "0.6rem 0.875rem",
                borderRadius: 8,
                border: `1.5px solid ${border}`,
                background: bg,
                textAlign: "left",
                fontSize: "0.9375rem",
                cursor: answered ? "default" : "pointer",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <p style={{ fontSize: "0.875rem", color: correct ? "#166534" : "#991b1b", margin: 0 }}>
          {correct ? "Correct — " : "Not quite — "}{q.explanation}
        </p>
      )}
    </div>
  );
}

function NoteCard({
  artifact,
  onRate,
}: {
  artifact: ArtifactItem;
  onRate: (outcome: "passed" | "failed") => void;
}) {
  const title = artifact.content.title as string | undefined;
  const body = artifact.content.body_markdown as string | undefined;

  return (
    <div style={s.card}>
      <span style={s.typeBadge}>Note</span>
      {title && <p style={{ ...s.cardBody, fontWeight: 700 }}>{title}</p>}
      {body && <MarkdownContent>{body}</MarkdownContent>}
      <button type="button" style={{ ...s.rateBtn, background: "#dcfce7", color: "#166534", alignSelf: "flex-start" }} onClick={() => onRate("passed")}>
        Got it
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared header
// ---------------------------------------------------------------------------

function Header({ active }: { active: "dashboard" | "capture" | "review" | "history" }) {
  const navItems = [
    { label: "Home", href: "/dashboard", key: "dashboard" },
    { label: "Capture", href: "/capture", key: "capture" },
    { label: "Review", href: "/review", key: "review" },
    { label: "History", href: "/artifacts", key: "history" },
  ] as const;

  return (
    <header style={s.header}>
      <Link href="/capture" style={s.logo}>Studigital</Link>
      <nav style={s.nav}>
        {navItems.map(({ label, href, key }) =>
          key === active ? (
            <span key={key} style={{ ...s.navLink, color: "#1a1a1a", fontWeight: 700 }}>{label}</span>
          ) : (
            <Link key={key} href={href} style={s.navLink}>{label}</Link>
          )
        )}
      </nav>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fafafa" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "1rem 1.5rem", borderBottom: "1px solid #eee", background: "#fff",
  },
  logo: { fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.01em", textDecoration: "none", color: "inherit" },
  nav: { display: "flex", gap: "1.5rem", alignItems: "center" },
  navLink: { fontSize: "0.9375rem", color: "#666", textDecoration: "none", fontWeight: 500 },
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
  drillHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  exitBtn: { background: "none", border: "none", color: "#6b7280", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", padding: 0 },
  progress: { fontSize: "0.875rem", color: "#9ca3af", fontWeight: 500 },
  card: {
    background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12,
    padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem",
  },
  typeBadge: {
    fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em",
    color: "#6b7280", textTransform: "uppercase",
  },
  cardBody: { fontSize: "1.0625rem", lineHeight: 1.6, margin: 0, color: "#1a1a1a" },
  flipBtn: {
    padding: "0.6rem 1.25rem", borderRadius: 8, border: "1.5px solid #e5e7eb",
    background: "#f9fafb", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start",
  },
  rateRow: { display: "flex", gap: "0.75rem" },
  rateBtn: {
    flex: 1, padding: "0.6rem", borderRadius: 8, border: "none",
    fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer",
  },
};
