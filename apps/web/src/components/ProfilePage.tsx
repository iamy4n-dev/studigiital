"use client";

import { useEffect, useState } from "react";
import { tagColors } from "@/lib/tagColor";
import { AppNav } from "@/components/AppNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TagMastery {
  tag: string;
  item_count: number;
  passed_count: number;
  mastery_pct: number;
  above_threshold: boolean;
}

interface ActivitySummary {
  mistakes_resolved_this_week: number;
  tags_improved_this_week: number;
}

interface MasteryData {
  tags: TagMastery[];
  activity: ActivitySummary;
  streak_days: number;
  xp: number;
}

export function ProfilePage({ getToken }: { getToken: () => Promise<string | null> }) {
  const [data, setData] = useState<MasteryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v1/profile/mastery`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        setData(await res.json());
      } catch {
        setError("Could not load profile");
      }
    }
    load();
  }, [getToken]);

  return (
    <div style={s.shell}>
      <AppNav active="profile" />

      <main style={s.main}>
        <h1 style={s.heading}>Profile</h1>

        {!data && !error && <p style={{ color: "#888" }}>Loading…</p>}
        {error && <p style={{ color: "#c00" }}>{error}</p>}

        {data && (
          <>
            <div style={s.statsRow}>
              <div style={s.statCard}>
                <span style={s.statValue}>{data.streak_days}</span>
                <span style={s.statLabel}>Day streak</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statValue}>{data.xp}</span>
                <span style={s.statLabel}>XP</span>
              </div>
            </div>

            <section>
              <h2 style={s.sectionHeading}>This week</h2>
              <p style={s.activityLine}>
                {data.activity.mistakes_resolved_this_week} mistakes resolved{" "}
                <span
                  title="Items you had trouble with at some point, resolved this week."
                  style={s.hint}
                >
                  (i)
                </span>
              </p>
              <p style={s.activityLine}>
                {data.activity.tags_improved_this_week} tags improved
              </p>
            </section>

            <section>
              <h2 style={s.sectionHeading}>Tag mastery</h2>
              {data.tags.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                  No tagged artifacts yet — complete a drill to see mastery scores.
                </p>
              ) : (
                <div style={s.tagGrid}>
                  {data.tags.map((t) => {
                    const { bg, text } = tagColors(t.tag);
                    return (
                      <div key={t.tag} style={s.tagRow}>
                        <div style={s.tagLeft}>
                          <span style={{ ...s.tagChip, background: bg, color: text }}>
                            {t.tag}
                          </span>
                          {t.above_threshold && (
                            <span style={s.masteredBadge}>Mastered</span>
                          )}
                        </div>
                        <div style={s.barWrap}>
                          <div
                            style={{
                              ...s.barFill,
                              width: `${t.mastery_pct}%`,
                              background: t.above_threshold ? "#166534" : "#1a1a1a",
                            }}
                          />
                        </div>
                        <span style={s.pct}>{t.mastery_pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fafafa" },
  main: { flex: 1, maxWidth: 600, width: "100%", margin: "0 auto", padding: "2rem 1rem" },
  heading: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1.5rem" },
  statsRow: { display: "flex", gap: "1rem", marginBottom: "2rem" },
  statCard: {
    flex: 1, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10,
    padding: "1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
  },
  statValue: { fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#1a1a1a" },
  statLabel: { fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", letterSpacing: "0.04em", textTransform: "uppercase" },
  sectionHeading: {
    fontSize: "0.875rem", fontWeight: 600, color: "#6b7280",
    letterSpacing: "0.05em", textTransform: "uppercase" as const,
    marginBottom: "0.75rem", marginTop: "1.25rem",
  },
  activityLine: { fontSize: "0.9375rem", color: "#374151", margin: "0 0 0.25rem" },
  tagGrid: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  tagRow: { display: "flex", alignItems: "center", gap: "0.75rem" },
  tagLeft: { display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 160 },
  tagChip: {
    fontSize: "0.75rem", fontWeight: 600, padding: "0.15rem 0.5rem",
    borderRadius: 999, letterSpacing: "0.03em",
  },
  masteredBadge: {
    fontSize: "0.6875rem", fontWeight: 700, color: "#166534",
    background: "#dcfce7", padding: "0.1rem 0.4rem", borderRadius: 999,
  },
  barWrap: { flex: 1, height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999, transition: "width 0.3s ease" },
  pct: { fontSize: "0.8125rem", fontWeight: 600, color: "#6b7280", minWidth: 36, textAlign: "right" as const },
  hint: { fontSize: "0.75rem", color: "#9ca3af", cursor: "default" },
};
