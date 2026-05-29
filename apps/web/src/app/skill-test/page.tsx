"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import type { TransformResult, SuggestTagsResult, QuizQuestion, FlashcardPair } from "@/lib/transform";
import { MarkdownContent } from "@/lib/MarkdownContent";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

type Skill = "generate_flashcard" | "generate_note" | "generate_quiz" | "suggest_tags";

type Result = TransformResult | SuggestTagsResult;

type Phase =
  | { status: "idle" }
  | { status: "running" }
  | { status: "result"; data: Result }
  | { status: "error"; message: string };

const SKILLS: { value: Skill; label: string }[] = [
  { value: "generate_flashcard", label: "Generate Flashcard" },
  { value: "generate_note", label: "Generate Note" },
  { value: "generate_quiz", label: "Generate Quiz" },
  { value: "suggest_tags", label: "Suggest Tags" },
];

export default function SkillTestPage() {
  return DEV_MODE ? <SkillTestShell getToken={async () => null} /> : <AuthSkillTest />;
}

function AuthSkillTest() {
  const { getToken } = useAuth();
  return <SkillTestShell getToken={getToken} />;
}

function SkillTestShell({ getToken }: { getToken: () => Promise<string | null> }) {
  const [skill, setSkill] = useState<Skill>("generate_flashcard");
  const [text, setText] = useState("");
  const [tier, setTier] = useState<"free" | "paid">("free");
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPhase({ status: "running" });
    try {
      const token = await getToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      let res: Response;
      if (skill === "suggest_tags") {
        res = await fetch("/api/v1/captures/suggest-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ text: text.trim() }),
        });
      } else {
        res = await fetch("/api/v1/captures/transform", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ text: text.trim(), skill_name: skill, tier }),
        });
      }

      if (!res.ok) {
        const err = await res.text();
        setPhase({ status: "error", message: `${res.status}: ${err}` });
        return;
      }

      const data: Result = await res.json();
      setPhase({ status: "result", data });
    } catch (err) {
      setPhase({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.logo}>Studigital</span>
        <span style={s.badge}>Skill Tester</span>
      </header>

      <main style={s.main}>
        <form onSubmit={run} style={s.form}>
          <div style={s.row}>
            <label style={s.label} htmlFor="skill-select">
              Skill
            </label>
            <select
              id="skill-select"
              style={s.select}
              value={skill}
              onChange={(e) => {
                setSkill(e.target.value as Skill);
                setPhase({ status: "idle" });
              }}
            >
              {SKILLS.map((sk) => (
                <option key={sk.value} value={sk.value}>
                  {sk.label}
                </option>
              ))}
            </select>
          </div>

          {skill !== "suggest_tags" && (
            <div style={s.row}>
              <label style={s.label} htmlFor="tier-select">
                Tier
              </label>
              <select
                id="tier-select"
                style={s.select}
                value={tier}
                onChange={(e) => setTier(e.target.value as "free" | "paid")}
              >
                <option value="free">free</option>
                <option value="paid">paid</option>
              </select>
            </div>
          )}

          <textarea
            style={s.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter some text to transform…"
            rows={5}
            autoFocus
            disabled={phase.status === "running"}
          />

          <button
            type="submit"
            style={{ ...s.button, opacity: phase.status === "running" || !text.trim() ? 0.6 : 1 }}
            disabled={phase.status === "running" || !text.trim()}
          >
            {phase.status === "running" ? "Running…" : `Run ${SKILLS.find((sk) => sk.value === skill)?.label}`}
          </button>
        </form>

        {phase.status === "result" && (
          <div style={s.result}>
            <SkillResult data={phase.data} />
            <button style={{ ...s.button, marginTop: "1rem" }} onClick={() => setPhase({ status: "idle" })}>
              Reset
            </button>
          </div>
        )}

        {phase.status === "error" && (
          <div style={s.result}>
            <p style={s.error}>{phase.message}</p>
            <button style={s.button} onClick={() => setPhase({ status: "idle" })}>
              Reset
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SkillResult({ data }: { data: Result }) {
  if ("suggestions" in data) {
    return (
      <div>
        <p style={s.meta}>Suggested tags</p>
        <div style={s.tagRow}>
          {data.suggestions.map((tag) => (
            <span key={tag} style={s.tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (data.skill_name === "generate_flashcard") {
    return (
      <div>
        <p style={s.meta}>{data.cards.length} flashcard{data.cards.length !== 1 ? "s" : ""}</p>
        <div style={s.stack}>
          {data.cards.map((card, i) => (
            <FlipCard key={i} card={card} />
          ))}
        </div>
        {data.source_summary && <p style={s.summary}>{data.source_summary}</p>}
      </div>
    );
  }

  if (data.skill_name === "generate_note") {
    return (
      <div style={s.stack}>
        <p style={s.meta}>Note</p>
        <h2 style={s.noteTitle}>{data.title}</h2>
        <MarkdownContent>{data.body_markdown}</MarkdownContent>
        <ul style={s.keyPoints}>
          {data.key_points.map((pt, i) => (
            <li key={i}>{pt}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (data.skill_name === "generate_quiz") {
    return (
      <div style={s.stack}>
        <p style={s.meta}>{data.questions.length} question{data.questions.length !== 1 ? "s" : ""}</p>
        {data.questions.map((q, i) => (
          <QuizCard key={i} question={q} />
        ))}
      </div>
    );
  }

  return null;
}

function FlipCard({ card }: { card: FlashcardPair }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={s.card} onClick={() => setFlipped((f) => !f)} role="button">
      <span style={s.cardLabel}>{flipped ? "Back" : "Front"}</span>
      <p style={s.cardText}>{flipped ? card.back : card.front}</p>
      <span style={s.hint}>tap to flip</span>
    </div>
  );
}

function QuizCard({ question }: { question: QuizQuestion }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={s.card}>
      <p style={s.cardText}>{question.stem}</p>
      <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
        {question.options.map((opt, i) => (
          <li
            key={i}
            style={{
              color: revealed ? (i === question.correct_index ? "#15803d" : "#aaa") : "inherit",
              fontWeight: revealed && i === question.correct_index ? 700 : "normal",
            }}
          >
            {opt}
          </li>
        ))}
      </ol>
      {revealed ? (
        <p style={s.summary}>{question.explanation}</p>
      ) : (
        <button style={{ ...s.button, fontSize: "0.875rem", padding: "0.5rem 1rem" }} onClick={() => setRevealed(true)}>
          Reveal answer
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fafafa" },
  header: {
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "1rem 1.5rem", borderBottom: "1px solid #eee", background: "#fff",
  },
  logo: { fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.01em" },
  badge: {
    fontSize: "0.75rem", fontWeight: 600, background: "#f0f0f0",
    borderRadius: 4, padding: "0.2rem 0.5rem", color: "#555",
  },
  main: { flex: 1, padding: "2rem 1rem", maxWidth: 600, margin: "0 auto", width: "100%" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  row: { display: "flex", alignItems: "center", gap: "0.75rem" },
  label: { fontSize: "0.875rem", fontWeight: 600, minWidth: 40 },
  select: {
    padding: "0.5rem 0.75rem", fontSize: "0.9375rem", border: "1.5px solid #ddd",
    borderRadius: 8, background: "#fff", fontFamily: "inherit",
  },
  textarea: {
    width: "100%", padding: "0.875rem", fontSize: "1rem",
    border: "1.5px solid #ddd", borderRadius: 8, resize: "vertical",
    fontFamily: "inherit", background: "#fff",
  },
  button: {
    alignSelf: "flex-start", background: "#1a1a1a", color: "#fff",
    border: "none", borderRadius: 8, padding: "0.75rem 1.5rem",
    fontSize: "1rem", fontWeight: 600, cursor: "pointer",
  },
  result: { marginTop: "2rem", display: "flex", flexDirection: "column" },
  error: { color: "#c00", marginBottom: "1rem" },
  meta: {
    fontSize: "0.75rem", fontWeight: 700, color: "#888",
    textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.75rem",
  },
  stack: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: {
    background: "#fff", border: "1.5px solid #ddd", borderRadius: 12,
    padding: "1.25rem", cursor: "pointer", userSelect: "none",
    display: "flex", flexDirection: "column", gap: "0.5rem",
  },
  cardLabel: { fontSize: "0.7rem", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em" },
  cardText: { fontSize: "1rem", lineHeight: 1.6, margin: 0 },
  hint: { fontSize: "0.7rem", color: "#ccc", alignSelf: "flex-end" },
  summary: { fontSize: "0.875rem", color: "#666", fontStyle: "italic", borderLeft: "3px solid #eee", paddingLeft: "0.75rem", margin: 0 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  tag: { background: "#f0f0f0", borderRadius: 4, padding: "0.25rem 0.625rem", fontSize: "0.875rem", fontWeight: 500 },
  noteTitle: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em", margin: 0 },
  noteBody: { fontSize: "1rem", lineHeight: 1.7, color: "#333", margin: 0, whiteSpace: "pre-wrap" },
  keyPoints: { margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9375rem" },
};
