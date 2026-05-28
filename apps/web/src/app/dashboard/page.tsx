"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SKILL_LABELS, SKILL_NAMES, otherSkills, type SkillName } from "@/lib/skills";
import { buildCaptureUrl } from "@/lib/captureUrl";
import { countByType, thisWeekCount } from "@/lib/artifactStats";
import { AppNav } from "@/components/AppNav";

interface ArtifactOut {
  id: string;
  capture_id: string;
  artifact_type: string;
  content: Record<string, unknown>;
  created_at: string;
  source_text: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function DashboardPage() {
  return DEV_MODE ? <Dashboard getToken={async () => null} showUser={false} /> : <AuthDashboard />;
}

function AuthDashboard() {
  const { getToken } = useAuth();
  return <Dashboard getToken={getToken} showUser />;
}

function Dashboard({
  getToken,
  showUser,
}: {
  getToken: () => Promise<string | null>;
  showUser: boolean;
}) {
  const [artifacts, setArtifacts] = useState<ArtifactOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v1/artifacts/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        setArtifacts(await res.json());
      } catch {
        setError("Could not load your history.");
      }
    }
    load();
  }, [getToken]);

  const counts = artifacts ? countByType(artifacts) : null;
  const weekCount = artifacts ? thisWeekCount(artifacts) : null;
  const recent = artifacts ? artifacts.slice(0, 5) : null;

  return (
    <div style={styles.shell}>
      <AppNav active="dashboard" rightSlot={showUser ? <UserButton /> : undefined} />

      <main style={styles.main}>
        {/* Stats bar */}
        <section style={styles.statsRow}>
          <StatCard
            label="This week"
            value={weekCount ?? "—"}
            sub="artifacts"
          />
          <StatCard
            label="Flashcards"
            value={counts?.generate_flashcard ?? "—"}
            color="#dbeafe"
          />
          <StatCard
            label="Notes"
            value={counts?.generate_note ?? "—"}
            color="#dcfce7"
          />
          <StatCard
            label="Quizzes"
            value={counts?.generate_quiz ?? "—"}
            color="#fef9c3"
          />
        </section>

        {/* CTA */}
        <section style={styles.ctaSection}>
          <h1 style={styles.ctaHeading}>What did you just learn?</h1>
          <p style={styles.ctaSub}>Capture a mistake or insight and turn it into a flashcard, note, or quiz in seconds.</p>
          <Link href="/capture" style={styles.ctaButton}>
            Capture something →
          </Link>
        </section>

        {/* Recent artifacts */}
        <section style={styles.recentSection}>
          <div style={styles.recentHeader}>
            <h2 style={styles.sectionTitle}>Recent</h2>
            {artifacts && artifacts.length > 5 && (
              <Link href="/artifacts" style={styles.viewAll}>View all →</Link>
            )}
          </div>

          {artifacts === null && error === null && (
            <p style={styles.meta}>Loading…</p>
          )}

          {error && <p style={{ color: "#c00", fontSize: "0.9rem" }}>{error}</p>}

          {artifacts !== null && artifacts.length === 0 && (
            <div style={styles.empty}>
              <p>Nothing yet — capture your first note above.</p>
            </div>
          )}

          {recent && recent.length > 0 && (
            <div style={styles.list}>
              {recent.map((a) => (
                <ArtifactRow key={a.id} artifact={a} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ ...styles.statCard, background: color ?? "#f9fafb" }}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
      {sub && <span style={styles.statSub}>{sub}</span>}
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: ArtifactOut }) {
  const badge = BADGE_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const preview = getPreview(artifact);
  const date = new Date(artifact.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rerunSkills = (SKILL_NAMES as readonly string[]).includes(artifact.artifact_type)
    ? otherSkills(artifact.artifact_type as SkillName)
    : null;

  return (
    <div style={styles.row} title={artifact.source_text || undefined}>
      <div style={styles.rowMain}>
        <span style={{ ...styles.badge, background: BADGE_COLORS[artifact.artifact_type] ?? "#eee" }}>
          {badge}
        </span>
        <p style={styles.rowPreview}>{preview}</p>
        <span style={styles.rowDate}>{date}</span>
      </div>
      {rerunSkills && artifact.source_text && (
        <div style={styles.rowActions}>
          {rerunSkills.map((s) => (
            <a key={s} href={buildCaptureUrl(artifact.source_text, s)} style={styles.rerunLink}>
              {SKILL_LABELS[s]} →
            </a>
          ))}
        </div>
      )}
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
  main: {
    flex: 1,
    maxWidth: 640,
    width: "100%",
    margin: "0 auto",
    padding: "2rem 1rem",
    display: "flex",
    flexDirection: "column",
    gap: "2.5rem",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.75rem",
  },
  statCard: {
    borderRadius: 10,
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    border: "1px solid #e5e7eb",
  },
  statValue: {
    fontSize: "1.75rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#555",
  },
  statSub: {
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
  ctaSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    padding: "1.75rem",
  },
  ctaHeading: {
    fontSize: "1.25rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  ctaSub: {
    fontSize: "0.9375rem",
    color: "#666",
    margin: 0,
    lineHeight: 1.5,
  },
  ctaButton: {
    alignSelf: "flex-start",
    background: "#1a1a1a",
    color: "#fff",
    borderRadius: 8,
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    fontWeight: 600,
    textDecoration: "none",
    marginTop: "0.25rem",
  },
  recentSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  recentHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  viewAll: {
    fontSize: "0.875rem",
    color: "#6b7280",
    textDecoration: "none",
    fontWeight: 500,
  },
  meta: {
    color: "#888",
    fontSize: "0.9375rem",
  },
  empty: {
    color: "#888",
    fontSize: "0.9375rem",
    padding: "1rem 0",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  row: {
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    padding: "0.875rem 1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  rowMain: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexShrink: 0,
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "0.2rem 0.5rem",
    borderRadius: 999,
    color: "#374151",
  },
  rowPreview: {
    fontSize: "0.9375rem",
    color: "#374151",
    margin: 0,
    flex: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  rowDate: {
    flexShrink: 0,
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
  rowActions: {
    display: "flex",
    gap: "0.75rem",
    flexShrink: 0,
  },
  rerunLink: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#6b7280",
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
};
