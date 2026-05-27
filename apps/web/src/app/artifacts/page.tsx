"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ArtifactOut {
  id: string;
  capture_id: string;
  artifact_type: string;
  content: Record<string, unknown>;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function ArtifactsPage() {
  return DEV_MODE ? <ArtifactList getToken={async () => null} /> : <AuthArtifactList />;
}

function AuthArtifactList() {
  const { getToken } = useAuth();
  return <ArtifactList getToken={getToken} />;
}

function ArtifactList({ getToken }: { getToken: () => Promise<string | null> }) {
  const [artifacts, setArtifacts] = useState<ArtifactOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v1/artifacts/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        setArtifacts(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    load();
  }, [getToken]);

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <Link href="/capture" style={styles.logo}>
          Studigital
        </Link>
        <nav style={styles.nav}>
          <Link href="/capture" style={styles.navLink}>
            Capture
          </Link>
          <span style={{ ...styles.navLink, color: "#1a1a1a", fontWeight: 700 }}>History</span>
        </nav>
      </header>

      <main style={styles.main}>
        <h1 style={styles.heading}>History</h1>

        {artifacts === null && error === null && (
          <p style={styles.meta}>Loading…</p>
        )}

        {error && <p style={{ color: "#c00" }}>{error}</p>}

        {artifacts !== null && artifacts.length === 0 && (
          <div style={styles.empty}>
            <p>No artifacts yet.</p>
            <Link href="/capture" style={styles.ctaLink}>
              Capture something →
            </Link>
          </div>
        )}

        {artifacts !== null && artifacts.length > 0 && (
          <div style={styles.list}>
            {artifacts.map((a) => (
              <ArtifactCard key={a.id} artifact={a} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: ArtifactOut }) {
  const preview = getPreview(artifact);
  const badge = BADGE_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const date = new Date(artifact.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <span style={{ ...styles.badge, background: BADGE_COLORS[artifact.artifact_type] ?? "#eee" }}>
          {badge}
        </span>
        <span style={styles.timestamp}>{date}</span>
      </div>
      <p style={styles.preview}>{preview}</p>
    </div>
  );
}

function getPreview(artifact: ArtifactOut): string {
  const c = artifact.content;
  if (artifact.artifact_type === "generate_flashcard") {
    const cards = c.cards as Array<{ front: string }> | undefined;
    return cards?.[0]?.front ?? "—";
  }
  if (artifact.artifact_type === "generate_note") {
    return (c.title as string | undefined) ?? "—";
  }
  if (artifact.artifact_type === "generate_quiz") {
    const questions = c.questions as Array<{ stem: string }> | undefined;
    return questions?.[0]?.stem ?? "—";
  }
  return "—";
}

const BADGE_LABELS: Record<string, string> = {
  generate_flashcard: "Flashcard",
  generate_note: "Note",
  generate_quiz: "Quiz",
};

const BADGE_COLORS: Record<string, string> = {
  generate_flashcard: "#dbeafe",
  generate_note: "#dcfce7",
  generate_quiz: "#fef9c3",
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#fafafa",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.5rem",
    borderBottom: "1px solid #eee",
    background: "#fff",
  },
  logo: {
    fontWeight: 700,
    fontSize: "1.125rem",
    letterSpacing: "-0.01em",
    textDecoration: "none",
    color: "inherit",
  },
  nav: {
    display: "flex",
    gap: "1.5rem",
    alignItems: "center",
  },
  navLink: {
    fontSize: "0.9375rem",
    color: "#666",
    textDecoration: "none",
    fontWeight: 500,
  },
  main: {
    flex: 1,
    maxWidth: 600,
    width: "100%",
    margin: "0 auto",
    padding: "2rem 1rem",
  },
  heading: {
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: "1.5rem",
  },
  meta: {
    color: "#888",
    fontSize: "0.9375rem",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    color: "#666",
  },
  ctaLink: {
    color: "#1a1a1a",
    fontWeight: 600,
    textDecoration: "none",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  card: {
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    padding: "1rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    color: "#374151",
  },
  timestamp: {
    fontSize: "0.8125rem",
    color: "#9ca3af",
  },
  preview: {
    fontSize: "0.9375rem",
    color: "#374151",
    lineHeight: 1.5,
    margin: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
};
