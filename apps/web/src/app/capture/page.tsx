"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import type { FlashcardPair, QuizQuestion, TransformResult } from "@/lib/transform";
import { MarkdownContent } from "@/lib/MarkdownContent";

type Phase =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "result"; data: TransformResult }
  | { status: "error"; message: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function CapturePage() {
  return DEV_MODE ? <CaptureShell getToken={async () => null} showUser={false} /> : <AuthCapturePage />;
}

function AuthCapturePage() {
  const { getToken } = useAuth();
  return <CaptureShell getToken={getToken} showUser />;
}

function CaptureShell({
  getToken,
  showUser,
}: {
  getToken: () => Promise<string | null>;
  showUser: boolean;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setPhase({ status: "submitting" });

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v1/captures/transform`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: text.trim(), tier: "free" }),
      });

      if (!res.ok) {
        const err = await res.text();
        setPhase({ status: "error", message: `Server error ${res.status}: ${err}` });
        return;
      }

      const data: TransformResult = await res.json();
      setPhase({ status: "result", data });
    } catch (err) {
      setPhase({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  function reset() {
    setText("");
    setPhase({ status: "idle" });
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.logo}>Studigital</span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
          <ResultView data={phase.data} onReset={reset} />
        ) : (
          <ErrorView message={phase.message} onReset={reset} />
        )}
      </main>
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

function ResultView({ data, onReset }: { data: TransformResult; onReset: () => void }) {
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
