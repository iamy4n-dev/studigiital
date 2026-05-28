/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardCard, NoteCard, QuizCard } from "../src/components/DrillCards";
import type { DrillItem } from "../src/components/DrillCards";

jest.mock("@/lib/MarkdownContent", () => ({
  MarkdownContent: ({ children }: { children: string }) => <div>{children}</div>,
}));

const flashcard: DrillItem = {
  id: "fc-1",
  artifact_id: "a-1",
  item_type: "flashcard",
  content: { front: "What is photosynthesis?", back: "Light → sugar in plants" },
  tags: [],
  source_text: "",
};

const note: DrillItem = {
  id: "note-1",
  artifact_id: "a-2",
  item_type: "note",
  content: { title: "Krebs cycle", body_markdown: "Produces ATP via TCA." },
  tags: [],
  source_text: "",
};

const quiz: DrillItem = {
  id: "quiz-1",
  artifact_id: "a-3",
  item_type: "quiz_question",
  content: {
    stem: "What gas do plants absorb?",
    options: ["Oxygen", "CO2", "Nitrogen"],
    correct_index: 1,
    explanation: "Plants absorb CO2 for photosynthesis.",
  },
  tags: [],
  source_text: "",
};

// ---------------------------------------------------------------------------
// Slice 1 — FlashcardCard shows front by default
// ---------------------------------------------------------------------------

test("FlashcardCard renders front content", () => {
  render(<FlashcardCard item={flashcard} onRate={() => {}} onNext={() => {}} />);
  expect(screen.getByText("What is photosynthesis?")).toBeInTheDocument();
  expect(screen.queryByText("Light → sugar in plants")).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 2 — "Got it" calls onRate and reveals Next button (not onNext)
// ---------------------------------------------------------------------------

test("FlashcardCard Got it fires onRate then shows Next button", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<FlashcardCard item={flashcard} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Got it"));

  expect(onRate).toHaveBeenCalledWith("passed");
  expect(onNext).not.toHaveBeenCalled();
  expect(screen.getByText("Next →")).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 3 — "Not yet" calls onRate and reveals Next button
// ---------------------------------------------------------------------------

test("FlashcardCard Not yet fires onRate then shows Next button", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<FlashcardCard item={flashcard} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Not yet"));

  expect(onRate).toHaveBeenCalledWith("failed");
  expect(onNext).not.toHaveBeenCalled();
  expect(screen.getByText("Next →")).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 4 — "Next →" calls onNext with the correct outcome, not onRate again
// ---------------------------------------------------------------------------

test("FlashcardCard Next calls onNext with passed outcome", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<FlashcardCard item={flashcard} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Got it"));
  fireEvent.click(screen.getByText("Next →"));

  expect(onNext).toHaveBeenCalledWith("passed");
  expect(onRate).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Slice 5 — NoteCard "Got it" fires onRate and shows Next button
// ---------------------------------------------------------------------------

test("NoteCard Got it fires onRate then shows Next button", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<NoteCard item={note} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("Got it"));

  expect(onRate).toHaveBeenCalledWith("passed");
  expect(onNext).not.toHaveBeenCalled();
  expect(screen.getByText("Next →")).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 6 — NoteCard "Next →" calls onNext with correct outcome
// ---------------------------------------------------------------------------

test("NoteCard Next calls onNext with passed outcome", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<NoteCard item={note} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("Got it"));
  fireEvent.click(screen.getByText("Next →"));

  expect(onNext).toHaveBeenCalledWith("passed");
  expect(onRate).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Slice 7 — QuizCard selecting answer fires onRate immediately
// ---------------------------------------------------------------------------

test("QuizCard selecting correct answer fires onRate with passed", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<QuizCard item={quiz} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("CO2"));

  expect(onRate).toHaveBeenCalledWith("passed");
  expect(onNext).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Slice 8 — QuizCard "Next →" calls onNext, not onRate again
// ---------------------------------------------------------------------------

test("QuizCard Next calls onNext and does not call onRate again", () => {
  const onRate = jest.fn();
  const onNext = jest.fn();
  render(<QuizCard item={quiz} onRate={onRate} onNext={onNext} />);

  fireEvent.click(screen.getByText("CO2"));
  fireEvent.click(screen.getByText("Next →"));

  expect(onNext).toHaveBeenCalledWith("passed");
  expect(onRate).toHaveBeenCalledTimes(1);
});
