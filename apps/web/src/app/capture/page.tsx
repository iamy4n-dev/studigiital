"use client";

import { useAuth } from "@clerk/nextjs";
import { AppNav } from "@/components/AppNav";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { mapErrorMessage } from "@/lib/errors";
import { uploadAndOcr } from "@/lib/photoUpload";
import { SKILL_LABELS, SKILL_NAMES, otherSkills, type SkillName } from "@/lib/skills";
import type { FlashcardPair, QuizQuestion, TransformResult } from "@/lib/transform";
import { MarkdownContent } from "@/lib/MarkdownContent";
import { TagConfirm } from "@/lib/TagConfirm";

type SkillChoice = "auto" | SkillName;

type CaptureMode = "text" | "photo";

type Phase =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "scanning" }
  | { status: "tag_confirm"; extractedText: string; suggestedTags: string[] }
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
    <CaptureShell getToken={async () => null} initialText={initialText} initialSkill={initialSkill} sourceArtifactId={sourceArtifactId} />
  ) : (
    <AuthCapturePage initialText={initialText} initialSkill={initialSkill} sourceArtifactId={sourceArtifactId} />
  );
}

function AuthCapturePage({ initialText, initialSkill, sourceArtifactId }: { initialText: string; initialSkill: SkillChoice; sourceArtifactId?: string }) {
  const { getToken } = useAuth();
  return <CaptureShell getToken={getToken} initialText={initialText} initialSkill={initialSkill} sourceArtifactId={sourceArtifactId} />;
}

function CaptureShell({
  getToken,
  initialText,
  initialSkill,
  sourceArtifactId,
}: {
  getToken: () => Promise<string | null>;
  initialText: string;
  initialSkill: SkillChoice;
  sourceArtifactId?: string;
}) {
  const [mode, setMode] = useState<CaptureMode>("text");
  const [text, setText] = useState(initialText);
  const [skill, setSkill] = useState<SkillChoice>(initialSkill);
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  async function runTransform(
    submitText: string,
    submitSkill: SkillChoice,
    confirmedTags: string[] = [],
  ) {
    setPhase({ status: "submitting" });
    try {
      const token = await getToken();
      const body: Record<string, unknown> = { text: submitText.trim(), tier: "free" };
      if (submitSkill !== "auto") body.skill_name = submitSkill;
      if (sourceArtifactId) body.source_artifact_id = sourceArtifactId;
      if (confirmedTags.length) body.confirmed_tags = confirmedTags;
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

  async function handlePhotoFile(file: File) {
    setPhase({ status: "uploading" });
    try {
      const token = await getToken();
      setPhase({ status: "scanning" });
      const { extracted_text, suggested_tags } = await uploadAndOcr(file, token);
      setPhase({ status: "tag_confirm", extractedText: extracted_text, suggestedTags: suggested_tags });
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
    if (phase.status === "result") runTransform(text, chosenSkill);
  }

  function reset() {
    setText("");
    setSkill("auto");
    setPhase({ status: "idle" });
  }

  return (
    <div style={styles.shell}>
      <AppNav active="capture" />
      {DEV_MODE && (
        <div style={styles.devBar}>
          <a href="/skill-test" style={styles.devLink}>Skill Tester ↗</a>
        </div>
      )}
      <main style={styles.main}>
        {phase.status === "idle" ? (
          <div style={styles.form}>
            <ModeToggle mode={mode} onChange={(m) => { setMode(m); setPhase({ status: "idle" }); }} />
            {mode === "text" ? (
              <form onSubmit={handleSubmit} style={{ display: "contents" }}>
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
            ) : (
              <PhotoIdleView onFile={handlePhotoFile} />
            )}
          </div>
        ) : phase.status === "uploading" ? (
          <StatusView message="Uploading photo…" />
        ) : phase.status === "scanning" ? (
          <StatusView message="Scanning text from photo…" />
        ) : phase.status === "tag_confirm" ? (
          <PreTransformTagConfirm
            extractedText={phase.extractedText}
            suggestedTags={phase.suggestedTags}
            onConfirm={(tags) => runTransform(phase.extractedText, "auto", tags)}
            onCancel={reset}
          />
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

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CaptureMode;
  onChange: (m: CaptureMode) => void;
}) {
  return (
    <div style={styles.toggleGroup} role="group" aria-label="Capture mode">
      {(["text", "photo"] as CaptureMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          style={{
            ...styles.toggleButton,
            ...(mode === m ? styles.toggleButtonActive : {}),
          }}
        >
          {m === "text" ? "Text" : "Photo"}
        </button>
      ))}
    </div>
  );
}

function PhotoIdleView({ onFile }: { onFile: (f: File) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={styles.label}>Snap or upload a photo of your notes</p>
      <label
        style={{
          ...styles.button,
          display: "inline-block",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        Choose photo →
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </label>
      <p style={{ fontSize: "0.8125rem", color: "#aaa" }}>
        On mobile, this opens your camera directly.
      </p>
    </div>
  );
}

function StatusView({ message }: { message: string }) {
  return (
    <div style={styles.progressContainer}>
      <div className="spinner" />
      <p style={styles.progressMessage}>{message}</p>
    </div>
  );
}

function PreTransformTagConfirm({
  extractedText,
  suggestedTags,
  onConfirm,
  onCancel,
}: {
  extractedText: string;
  suggestedTags: string[];
  onConfirm: (tags: string[]) => void;
  onCancel: () => void;
}) {
  const [tags, setTags] = useState<string[]>(suggestedTags);
  const [newTag, setNewTag] = useState("");

  function addTag(name: string) {
    const clean = name.trim().toLowerCase();
    if (!clean || tags.includes(clean)) return;
    setTags((prev) => [...prev, clean]);
  }

  function removeTag(name: string) {
    setTags((prev) => prev.filter((t) => t !== name));
  }

  return (
    <div style={{ ...styles.form, maxWidth: 520 }}>
      <p style={styles.label}>Text extracted from photo</p>
      <p
        style={{
          fontSize: "0.875rem",
          color: "#555",
          background: "#f9fafb",
          borderRadius: 8,
          padding: "0.75rem",
          border: "1px solid #e5e7eb",
          whiteSpace: "pre-wrap",
          maxHeight: 160,
          overflowY: "auto",
        }}
      >
        {extractedText}
      </p>
      <p style={styles.label}>Confirm tags before transforming</p>
      <div style={styles.toggleGroup}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              ...styles.toggleButton,
              ...styles.toggleButtonActive,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: "1rem", lineHeight: 1 }}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        <input
          style={styles.textarea}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(newTag);
              setNewTag("");
            }
          }}
          placeholder="Add tag…"
        />
        {newTag.trim() && (
          <button
            type="button"
            style={styles.button}
            onClick={() => { addTag(newTag); setNewTag(""); }}
          >
            Add
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          type="button"
          style={{ ...styles.button, opacity: tags.length === 0 ? 0.6 : 1 }}
          disabled={tags.length === 0}
          onClick={() => onConfirm(tags)}
        >
          Confirm →
        </button>
        <button
          type="button"
          style={{ ...styles.button, background: "#fff", color: "#555", border: "1.5px solid #ddd" }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
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
  devBar: {
    padding: "0.375rem 1.5rem",
    borderBottom: "1px solid #f3f4f6",
    background: "#fafafa",
    fontSize: "0.8125rem",
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
};
