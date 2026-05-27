"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { mapErrorMessage } from "@/lib/errors";
import { SKILL_LABELS, SKILL_NAMES, otherSkills, type SkillName } from "@/lib/skills";
import type { FlashcardPair, QuizQuestion, TransformResult } from "@/lib/transform";
import { MarkdownContent } from "@/lib/MarkdownContent";
import { tagColors } from "@/lib/tagColor";

type SkillChoice = "auto" | SkillName;

type Phase =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "result"; data: TransformResult }
  | { status: "error"; message: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureEntry />
    </Suspense>
  );
}

function CaptureEntry() {
  const searchParams = useSearchParams();
  const initialText = searchParams.get("text") ?? "";
  const rawSkill = searchParams.get("skill");
  const initialSkill: SkillChoice = (SKILL_NAMES as readonly string[]).includes(rawSkill ?? "")
    ? (rawSkill as SkillName)
    : "auto";
  const sourceArtifactId = searchParams.get("source_artifact_id") ?? undefined;

  return DEV_MODE ? (
    <CaptureShell getToken={async () => null} showUser={false} initialText={initialText} initialSkill={initialSkill} sourceArtifactId={sourceArtifactId} />
  ) : (
    <AuthCapturePage initialText={initialText} initialSkill={initialSkill} sourceArtifactId={sourceArtifactId} />
  );
}

function AuthCapturePage({ initialText, initialSkill, sourceArtifactId }: { initialText: string; initialSkill: SkillChoice; sourceArtifactId?: string }) {
  const { getToken } = useAuth();
  return <CaptureShell getToken={getToken} showUser initialText={initialText} initialSkill={initialSkill} sourceArtifactId={sourceArtifactId} />;
}

function CaptureShell({
  getToken,
  showUser,
  initialText,
  initialSkill,
  sourceArtifactId,
}: {
  getToken: () => Promise<string | null>;
  showUser: boolean;
  initialText: string;
  initialSkill: SkillChoice;
  sourceArtifactId?: string;
}) {
  const [text, setText] = useState(initialText);
  const [skill, setSkill] = useState<SkillChoice>(initialSkill);
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  async function runTransform(submitText: string, submitSkill: SkillChoice) {
    setPhase({ status: "submitting" });
    try {
      const token = await getToken();
      const body: Record<string, string> = { text: submitText.trim(), tier: "free" };
      if (submitSkill !== "auto") body.skill_name = submitSkill;
      if (sourceArtifactId) body.source_artifact_id = sourceArtifactId;
      const res = await fetch(`${API_URL}/api/v1/captures/transform`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setPhase({ status: "error", message: mapErrorMessage(res.status) });
        return;
      }

      const data: TransformResult = await res.json();
      setPhase({ status: "result", data });
    } catch {
      setPhase({ status: "error", message: mapErrorMessage(0) });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    runTransform(text, skill);
  }

  function handleAlsoMake(chosenSkill: SkillName) {
    setSkill(chosenSkill);
    runTransform(text, chosenSkill);
  }

  function reset() {
    setText("");
    setSkill("auto");
    setPhase({ status: "idle" });
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.logo}>Studigital</span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <a href="/dashboard" style={styles.devLink}>
            Home
          </a>
          <a href="/artifacts" style={styles.devLink}>
            History
          </a>
          {DEV_MODE && (
            <a href="/skill-test" style={styles.devLink}>
              Skill Tester
            </a>
          )}
          {showUser && <UserButton />}
        </div>
      </header>

      <main style={styles.main}>
        {phase.status === "idle" ? (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label} htmlFor="capture-text">
              What did you just learn or get wrong?
            </label>
            <textarea
              id="capture-text"
              style={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. I confused 'affect' and 'effect' again..."
              rows={4}
              autoFocus
            />
            <SkillToggle selected={skill} onChange={setSkill} />
            <button
              type="submit"
              style={{ ...styles.button, opacity: !text.trim() ? 0.6 : 1 }}
              disabled={!text.trim()}
            >
              Transform →
            </button>
          </form>
        ) : phase.status === "submitting" ? (
          <TransformingView />
        ) : phase.status === "result" ? (
          <ResultView data={phase.data} onReset={reset} onAlsoMake={handleAlsoMake} getToken={getToken} />
        ) : (
          <ErrorView message={phase.message} onReset={reset} />
        )}
      </main>
    </div>
  );
}

function SkillToggle({ selected, onChange }: { selected: SkillChoice; onChange: (s: SkillChoice) => void }) {
  const options: { value: SkillChoice; label: string }[] = [
    { value: "auto", label: "Auto" },
    ...SKILL_NAMES.map((s) => ({ value: s as SkillChoice, label: SKILL_LABELS[s] })),
  ];
  return (
    <div style={styles.toggleGroup} role="group" aria-label="Output format">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          style={{
            ...styles.toggleButton,
            ...(selected === value ? styles.toggleButtonActive : {}),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const PROGRESS_MESSAGES = [
  "Reading your text…",
  "Figuring out the best format…",
  "Building your learning artifact…",
  "Almost there…",
];
const STEP_MS = [0, 2000, 5000, 9000];

function TransformingView() {
  const [msgIndex, setMsgIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleNext(index: number) {
      const next = index + 1;
      if (next >= STEP_MS.length) return;
      timerRef.current = setTimeout(() => {
        setMsgIndex(next);
        scheduleNext(next);
      }, STEP_MS[next]! - STEP_MS[index]!);
    }
    scheduleNext(0);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div style={styles.progressContainer}>
      <div className="spinner" />
      <p style={styles.progressMessage}>{PROGRESS_MESSAGES[msgIndex]}</p>
    </div>
  );
}

type ApiTagOut = { name: string; bg: string; text: string };

function TagConfirm({
  suggestions,
  artifactId,
  getToken,
}: {
  suggestions: string[];
  artifactId: string;
  getToken: () => Promise<string | null>;
}) {
  const [existingTags, setExistingTags] = useState<ApiTagOut[]>([]);
  // tags = the confirmed working list; pre-seeded from suggestions
  const [tags, setTags] = useState<string[]>(suggestions);
  const [newTag, setNewTag] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchExisting() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v1/tags/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setExistingTags(await res.json());
      } catch {
        // non-critical
      }
    }
    fetchExisting();
  }, [getToken]);

  function addTag(name: string) {
    const clean = name.trim().toLowerCase();
    if (!clean || tags.includes(clean)) return;
    setTags((prev) => [...prev, clean]);
  }

  function removeTag(name: string) {
    setTags((prev) => prev.filter((t) => t !== name));
  }

  function handleInput() {
    addTag(newTag);
    setNewTag("");
  }

  async function save() {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/v1/artifacts/${artifactId}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(tags),
      });
      setSaved(true);
    } catch {
      // non-critical; silently ignore
    }
  }

  if (saved) {
    return (
      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {tags.map((tag) => {
          const { bg, text } = tagColors(tag);
          return (
            <span
              key={tag}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.2rem 0.5rem",
                borderRadius: 999,
                background: bg,
                color: text,
              }}
            >
              {tag}
            </span>
          );
        })}
      </div>
    );
  }

  const pickable = existingTags.filter((t) => !tags.includes(t.name));

  return (
    <div style={styles.tagConfirmContainer}>
      <p style={styles.tagConfirmLabel}>Tags</p>

      {/* Working list — suggested + user-added, each removable */}
      <div style={styles.tagConfirmRow}>
        {tags.map((tag) => {
          const { bg, text } = tagColors(tag);
          return (
            <span
              key={tag}
              style={{ ...styles.tagChip, background: bg, color: text }}
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => removeTag(tag)}
                style={{ ...styles.tagChipRemove, color: text }}
              >
                ×
              </button>
            </span>
          );
        })}
        {tags.length === 0 && (
          <span style={styles.tagEmptyHint}>No tags yet — add one below</span>
        )}
      </div>

      {/* Free-text input to add a new tag */}
      <div style={styles.tagInputRow}>
        <input
          style={styles.tagInput}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleInput())}
          placeholder="Add tag…"
        />
        {newTag.trim() && (
          <button type="button" style={styles.tagAddButton} onClick={handleInput}>
            Add
          </button>
        )}
      </div>

      {/* Existing tags palette — click to add to the list */}
      {pickable.length > 0 && (
        <>
          <p style={styles.tagConfirmLabel}>Your tags</p>
          <div style={styles.tagConfirmRow}>
            {pickable.map(({ name, bg, text }) => (
              <button
                key={name}
                type="button"
                onClick={() => addTag(name)}
                style={{ ...styles.tagPickable, borderColor: bg, color: text }}
              >
                + {name}
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        style={{ ...styles.tagSaveButton, opacity: tags.length === 0 ? 0.4 : 1 }}
        disabled={tags.length === 0}
        onClick={save}
      >
        {tags.length > 0 ? `Save ${tags.length} tag${tags.length !== 1 ? "s" : ""} →` : "Add at least one tag"}
      </button>
    </div>
  );
}

function ResultView({
  data,
  onReset,
  onAlsoMake,
  getToken,
}: {
  data: TransformResult;
  onReset: () => void;
  onAlsoMake: (skill: SkillName) => void;
  getToken: () => Promise<string | null>;
}) {
  const alsoMake = otherSkills(data.skill_name);
  return (
    <div style={styles.resultContainer}>
      {data.skill_name === "generate_flashcard" && (
        <>
          <p style={styles.resultMeta}>
            {data.cards.length} flashcard{data.cards.length !== 1 ? "s" : ""} created
          </p>
          <div style={styles.cardStack}>
            {data.cards.map((card, i) => (
              <Flashcard key={i} card={card} />
            ))}
          </div>
          {data.source_summary && <p style={styles.summary}>{data.source_summary}</p>}
        </>
      )}
      {data.skill_name === "generate_note" && (
        <>
          <p style={styles.resultMeta}>Note created</p>
          <h2 style={styles.noteTitle}>{data.title}</h2>
          <MarkdownContent>{data.body_markdown}</MarkdownContent>
          {data.key_points.length > 0 && (
            <ul style={styles.keyPoints}>
              {data.key_points.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {data.skill_name === "generate_quiz" && (
        <>
          <p style={styles.resultMeta}>
            {data.questions.length} question{data.questions.length !== 1 ? "s" : ""} generated
          </p>
          {data.questions.map((q, qi) => (
            <QuizCard key={qi} question={q} />
          ))}
        </>
      )}
      {data.suggested_tags?.length > 0 && (
        <TagConfirm
          suggestions={data.suggested_tags}
          artifactId={data.artifact_id}
          getToken={getToken}
        />
      )}
      <p style={styles.savedNotice}>
        Saved to history ·{" "}
        <a href="/artifacts" style={styles.savedLink}>
          View all →
        </a>
      </p>
      <div style={styles.alsoMakeRow}>
        <span style={styles.alsoMakeLabel}>Also make:</span>
        {alsoMake.map((s) => (
          <button key={s} style={styles.alsoMakeButton} onClick={() => onAlsoMake(s)}>
            {SKILL_LABELS[s]}
          </button>
        ))}
      </div>
      <button style={styles.button} onClick={onReset}>
        Capture another →
      </button>
    </div>
  );
}

function Flashcard({ card }: { card: FlashcardPair }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      style={styles.flashcard}
      onClick={() => setFlipped((f) => !f)}
      role="button"
      aria-label={flipped ? "Show front" : "Reveal answer"}
    >
      <div style={styles.flashcardSide}>
        <span style={styles.flashcardLabel}>{flipped ? "Back" : "Front"}</span>
        <p style={styles.flashcardText}>{flipped ? card.back : card.front}</p>
      </div>
      <span style={styles.flipHint}>tap to flip</span>
    </div>
  );
}

function QuizCard({ question }: { question: QuizQuestion }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={styles.flashcard}>
      <p style={styles.flashcardText}>{question.stem}</p>
      <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
        {question.options.map((opt, i) => (
          <li
            key={i}
            style={{
              color: revealed
                ? i === question.correct_index
                  ? "#15803d"
                  : "#888"
                : "inherit",
              fontWeight: revealed && i === question.correct_index ? 700 : "normal",
            }}
          >
            {opt}
          </li>
        ))}
      </ol>
      {revealed ? (
        <p style={styles.summary}>{question.explanation}</p>
      ) : (
        <button
          style={{ ...styles.button, fontSize: "0.875rem", padding: "0.5rem 1rem" }}
          onClick={() => setRevealed(true)}
        >
          Reveal answer
        </button>
      )}
    </div>
  );
}

function ErrorView({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div style={styles.resultContainer}>
      <p style={{ color: "#c00", marginBottom: "1rem" }}>{message}</p>
      <button style={styles.button} onClick={onReset}>
        Try again →
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
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
  },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    width: "100%",
    maxWidth: 520,
  },
  label: {
    fontSize: "1.25rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  textarea: {
    width: "100%",
    padding: "0.875rem",
    fontSize: "1rem",
    border: "1.5px solid #ddd",
    borderRadius: 8,
    resize: "vertical",
    fontFamily: "inherit",
    outline: "none",
    background: "#fff",
  },
  toggleGroup: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
  },
  toggleButton: {
    background: "#fff",
    color: "#555",
    border: "1.5px solid #ddd",
    borderRadius: 8,
    padding: "0.4rem 0.9rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  toggleButtonActive: {
    background: "#1a1a1a",
    color: "#fff",
    border: "1.5px solid #1a1a1a",
  },
  button: {
    alignSelf: "flex-start",
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  progressContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
  },
  progressMessage: {
    fontSize: "1rem",
    color: "#555",
    fontWeight: 500,
  },
  resultContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    width: "100%",
    maxWidth: 520,
  },
  resultMeta: {
    fontSize: "0.875rem",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 600,
  },
  cardStack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  flashcard: {
    background: "#fff",
    border: "1.5px solid #ddd",
    borderRadius: 12,
    padding: "1.5rem",
    cursor: "pointer",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  flashcardSide: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  flashcardLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  flashcardText: {
    fontSize: "1rem",
    lineHeight: 1.6,
  },
  flipHint: {
    fontSize: "0.75rem",
    color: "#bbb",
    alignSelf: "flex-end",
  },
  devLink: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#888",
    textDecoration: "none",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: "0.2rem 0.6rem",
  },
  savedNotice: {
    fontSize: "0.8125rem",
    color: "#aaa",
  },
  savedLink: {
    color: "#aaa",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  alsoMakeRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
  },
  alsoMakeLabel: {
    fontSize: "0.875rem",
    color: "#888",
    fontWeight: 500,
  },
  alsoMakeButton: {
    background: "#fff",
    color: "#1a1a1a",
    border: "1.5px solid #ddd",
    borderRadius: 8,
    padding: "0.4rem 0.9rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  summary: {
    fontSize: "0.875rem",
    color: "#666",
    fontStyle: "italic",
    borderLeft: "3px solid #eee",
    paddingLeft: "0.75rem",
  },
  noteTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  noteBody: {
    fontSize: "1rem",
    lineHeight: 1.7,
    color: "#333",
    margin: 0,
    whiteSpace: "pre-wrap" as const,
  },
  keyPoints: {
    margin: 0,
    paddingLeft: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
    fontSize: "0.9375rem",
  },
  tagConfirmContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.625rem",
    padding: "0.875rem",
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
  },
  tagConfirmLabel: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  tagConfirmRow: {
    display: "flex",
    gap: "0.375rem",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  tagChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.2rem 0.375rem 0.2rem 0.625rem",
    borderRadius: 999,
  },
  tagChipRemove: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    lineHeight: 1,
    padding: 0,
    opacity: 0.65,
    fontWeight: 400,
  },
  tagEmptyHint: {
    fontSize: "0.8125rem",
    color: "#9ca3af",
    fontStyle: "italic" as const,
  },
  tagPickable: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    border: "1.5px solid",
    background: "#fff",
    cursor: "pointer",
  },
  tagInputRow: {
    display: "flex",
    gap: "0.375rem",
    alignItems: "center",
  },
  tagInput: {
    flex: 1,
    fontSize: "0.8125rem",
    padding: "0.3rem 0.6rem",
    border: "1.5px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    fontFamily: "inherit",
    background: "#fff",
  },
  tagAddButton: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.3rem 0.625rem",
    borderRadius: 6,
    border: "1.5px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
  },
  tagSaveButton: {
    alignSelf: "flex-start" as const,
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "0.35rem 0.875rem",
    borderRadius: 6,
    border: "none",
    background: "#1a1a1a",
    color: "#fff",
    cursor: "pointer",
  },
};
