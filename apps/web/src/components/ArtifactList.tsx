"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SKILL_LABELS, SKILL_NAMES, otherSkills, type SkillName } from "@/lib/skills";
import { buildCaptureUrl } from "@/lib/captureUrl";
import { tagColors } from "@/lib/tagColor";
import { partitionArtifacts, type ArtifactOut } from "@/lib/artifactPartition";
import { TagConfirm } from "@/lib/TagConfirm";
import { AppNav } from "@/components/AppNav";


export function ArtifactList({ getToken }: { getToken: () => Promise<string | null> }) {
  const [artifacts, setArtifacts] = useState<ArtifactOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`/api/v1/artifacts`, {
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
      <AppNav active="history" />

      <main style={styles.main}>
        <h1 style={styles.heading}>History</h1>

        {artifacts === null && error === null && (
          <p style={styles.meta}>Loading…</p>
        )}

        {error && <p style={{ color: "#c00" }}>{error}</p>}

        {artifacts !== null && artifacts.length === 0 && (
          <div style={styles.empty}>
            <p>Nothing here yet.</p>
            <Link href="/capture" style={styles.ctaLink}>
              Capture your first note →
            </Link>
          </div>
        )}

        {artifacts !== null && artifacts.length > 0 && (() => {
          const { drafts, tagged } = partitionArtifacts(artifacts);
          const handleTagged = (id: string, tags: string[]) => {
            setArtifacts((prev) =>
              prev
                ? prev.map((a) => (a.id === id ? { ...a, status: "tagged", tags } : a))
                : prev
            );
          };
          return (
            <>
              {drafts.length > 0 && (
                <section>
                  <h2 style={styles.sectionHeading}>Needs tagging</h2>
                  <div style={styles.list}>
                    {drafts.map((a) => (
                      <ArtifactCard key={a.id} artifact={a} getToken={getToken} onTagged={handleTagged} />
                    ))}
                  </div>
                </section>
              )}
              {tagged.length > 0 && (
                <section>
                  {drafts.length > 0 && <h2 style={styles.sectionHeading}>Tagged</h2>}
                  <div style={styles.list}>
                    {tagged.map((a) => (
                      <ArtifactCard key={a.id} artifact={a} getToken={getToken} onTagged={handleTagged} />
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        })()}
      </main>
    </div>
  );
}

function ArtifactCard({
  artifact,
  getToken,
  onTagged,
}: {
  artifact: ArtifactOut;
  getToken: () => Promise<string | null>;
  onTagged: (id: string, tags: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const preview = getPreview(artifact);
  const badge = BADGE_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const date = new Date(artifact.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rerunSkills = (SKILL_NAMES as readonly string[]).includes(artifact.artifact_type)
    ? otherSkills(artifact.artifact_type as SkillName)
    : null;

  async function expandWithSuggestions() {
    if (expanded) { setExpanded(false); return; }
    let seeded: string[] = [];
    if (artifact.tags.length === 0 && artifact.source_text) {
      const token = await getToken();
      const res = await fetch(`/api/v1/captures/suggest-tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: artifact.source_text, existing_tags: [] }),
      });
      if (res.ok) {
        const data = await res.json() as { suggestions: string[] };
        seeded = data.suggestions;
      }
    }
    setSuggestions(seeded);
    setExpanded(true);
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <span style={{ ...styles.badge, background: BADGE_COLORS[artifact.artifact_type] ?? "#eee" }}>
            {badge}
          </span>
          {artifact.status === "draft" && (
            <button style={styles.tagMeBadge} onClick={expandWithSuggestions}>
              Tag me
            </button>
          )}
        </div>
        <span style={styles.timestamp}>{date}</span>
      </div>
      <p style={styles.preview}>{preview}</p>
      {artifact.tags.length > 0 && (
        <div style={styles.tagRow}>
          {artifact.tags.map((tag) => {
            const { bg, text } = tagColors(tag);
            return (
              <span key={tag} style={{ ...styles.tag, background: bg, color: text }}>
                {tag}
              </span>
            );
          })}
        </div>
      )}
      {expanded && (
        <TagConfirm
          suggestions={suggestions}
          artifactId={artifact.id}
          getToken={getToken}
          onSaved={(tags) => { onTagged(artifact.id, tags); setExpanded(false); }}
        />
      )}
      {rerunSkills && artifact.source_text && (
        <div style={styles.rerunRow}>
          {rerunSkills.map((s) => (
            <a key={s} href={buildCaptureUrl(artifact.source_text, s, artifact.id)} style={styles.rerunLink}>
              Make {SKILL_LABELS[s]} →
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
  tagMeBadge: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    cursor: "pointer",
    border: "none",
  },
  sectionHeading: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#6b7280",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    marginBottom: "0.75rem",
    marginTop: "1.25rem",
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
  rerunRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap" as const,
    paddingTop: "0.25rem",
  },
  rerunLink: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#6b7280",
    textDecoration: "none",
  },
  tagRow: {
    display: "flex",
    gap: "0.375rem",
    flexWrap: "wrap" as const,
  },
  tag: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    padding: "0.15rem 0.5rem",
    borderRadius: 999,
  },
};
