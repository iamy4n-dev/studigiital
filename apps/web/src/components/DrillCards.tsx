"use client";

import { useEffect, useState } from "react";
import { MarkdownContent } from "@/lib/MarkdownContent";

export interface DrillItem {
  id: string;
  artifact_id: string;
  item_type: string;
  content: Record<string, unknown>;
  tags: string[];
  source_text: string;
}

interface CardProps {
  item: DrillItem;
  onRate: (outcome: "passed" | "failed") => void;
  onNext: (outcome: "passed" | "failed") => void;
}

export function ArtifactCard({ item, onRate, onNext }: CardProps) {
  if (item.item_type === "flashcard") return <FlashcardCard item={item} onRate={onRate} onNext={onNext} />;
  if (item.item_type === "quiz_question") return <QuizCard item={item} onRate={onRate} onNext={onNext} />;
  return <NoteCard item={item} onRate={onRate} onNext={onNext} />;
}

export function FlashcardCard({ item, onRate, onNext }: CardProps) {
  const [flipped, setFlipped] = useState(false);
  const [outcome, setOutcome] = useState<"passed" | "failed" | null>(null);
  const front = item.content.front as string | undefined;
  const back = item.content.back as string | undefined;

  const itemId = item.id;
  useEffect(() => { setFlipped(false); setOutcome(null); }, [itemId]);

  if (!front || !back) return null;

  function handleRate(o: "passed" | "failed") {
    setOutcome(o);
    onRate(o);
  }

  return (
    <div style={s.card}>
      <span style={s.typeBadge}>Flashcard</span>
      <p style={s.cardBody}>{flipped ? back : front}</p>
      {!flipped ? (
        <button type="button" style={s.flipBtn} onClick={() => setFlipped(true)}>
          Reveal answer
        </button>
      ) : outcome === null ? (
        <div style={s.rateRow}>
          <button type="button" style={{ ...s.rateBtn, background: "#dcfce7", color: "#166534" }} onClick={() => handleRate("passed")}>
            Got it
          </button>
          <button type="button" style={{ ...s.rateBtn, background: "#fee2e2", color: "#991b1b" }} onClick={() => handleRate("failed")}>
            Not yet
          </button>
        </div>
      ) : (
        <div style={s.rateRow}>
          <span style={{ ...s.ratedLabel, color: outcome === "passed" ? "#166534" : "#991b1b", background: outcome === "passed" ? "#dcfce7" : "#fee2e2" }}>
            {outcome === "passed" ? "Got it ✓" : "Not yet"}
          </span>
          <button type="button" style={s.nextBtn} onClick={() => onNext(outcome)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export function QuizCard({ item, onRate, onNext }: CardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [rated, setRated] = useState(false);
  const stem = item.content.stem as string | undefined;
  const options = item.content.options as string[] | undefined;
  const correctIndex = item.content.correct_index as number | undefined;
  const explanation = item.content.explanation as string | undefined;

  const itemId = item.id;
  useEffect(() => { setSelected(null); setRated(false); }, [itemId]);

  if (!stem || !options || correctIndex === undefined) return null;

  const answered = selected !== null;
  const correct = selected === correctIndex;

  function handleSelect(i: number) {
    if (rated) return;
    setSelected(i);
    setRated(true);
    onRate(i === correctIndex ? "passed" : "failed");
  }

  return (
    <div style={s.card}>
      <span style={s.typeBadge}>Quiz</span>
      <p style={s.cardBody}>{stem}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        {options.map((opt, i) => {
          let bg = "#f9fafb";
          let border = "#e5e7eb";
          if (answered) {
            if (i === correctIndex) { bg = "#dcfce7"; border = "#166534"; }
            else if (i === selected) { bg = "#fee2e2"; border = "#991b1b"; }
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(i)}
              style={{
                padding: "0.6rem 0.875rem", borderRadius: 8, border: `1.5px solid ${border}`,
                background: bg, textAlign: "left", fontSize: "0.9375rem",
                cursor: answered ? "default" : "pointer",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <>
          <p style={{ fontSize: "0.875rem", color: correct ? "#166534" : "#991b1b", margin: 0 }}>
            {correct ? "Correct — " : "Not quite — "}{explanation}
          </p>
          <button type="button" style={s.nextBtn} onClick={() => onNext(correct ? "passed" : "failed")}>
            Next →
          </button>
        </>
      )}
    </div>
  );
}

export function NoteCard({ item, onRate, onNext }: CardProps) {
  const [outcome, setOutcome] = useState<"passed" | "failed" | null>(null);
  const title = item.content.title as string | undefined;
  const body = item.content.body_markdown as string | undefined;

  const itemId = item.id;
  useEffect(() => setOutcome(null), [itemId]);

  function handleRate(o: "passed" | "failed") {
    setOutcome(o);
    onRate(o);
  }

  return (
    <div style={s.card}>
      <span style={s.typeBadge}>Note</span>
      {title && <p style={{ ...s.cardBody, fontWeight: 700 }}>{title}</p>}
      {body && <MarkdownContent>{body}</MarkdownContent>}
      {outcome === null ? (
        <div style={s.rateRow}>
          <button type="button" style={{ ...s.rateBtn, background: "#dcfce7", color: "#166534" }} onClick={() => handleRate("passed")}>
            Got it
          </button>
          <button type="button" style={{ ...s.rateBtn, background: "#fee2e2", color: "#991b1b" }} onClick={() => handleRate("failed")}>
            Not yet
          </button>
        </div>
      ) : (
        <div style={s.rateRow}>
          <span style={{ ...s.ratedLabel, color: outcome === "passed" ? "#166534" : "#991b1b", background: outcome === "passed" ? "#dcfce7" : "#fee2e2" }}>
            {outcome === "passed" ? "Got it ✓" : "Not yet"}
          </span>
          <button type="button" style={s.nextBtn} onClick={() => onNext(outcome)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
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
  ratedLabel: {
    flex: 1, padding: "0.6rem", borderRadius: 8, fontSize: "0.9375rem",
    fontWeight: 700, textAlign: "center" as const,
  },
  nextBtn: {
    flex: 1, padding: "0.6rem", borderRadius: 8, border: "1.5px solid #1a1a1a",
    background: "#1a1a1a", color: "#fff", fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer",
  },
};
