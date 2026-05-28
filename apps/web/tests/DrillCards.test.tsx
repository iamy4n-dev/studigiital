/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardCard, NoteCard } from "../src/components/DrillCards";
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

// ---------------------------------------------------------------------------
// Slice 1 — FlashcardCard shows front by default
// ---------------------------------------------------------------------------

test("FlashcardCard renders front content", () => {
  render(<FlashcardCard item={flashcard} onRate={() => {}} />);
  expect(screen.getByText("What is photosynthesis?")).toBeInTheDocument();
  expect(screen.queryByText("Light → sugar in plants")).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 2 — "Got it" directly calls onRate("passed") after reveal
// ---------------------------------------------------------------------------

test("FlashcardCard Got it calls onRate immediately after reveal", () => {
  const onRate = jest.fn();
  render(<FlashcardCard item={flashcard} onRate={onRate} />);

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Got it"));

  expect(onRate).toHaveBeenCalledWith("passed");
  expect(onRate).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Slice 3 — "Not yet" directly calls onRate("failed") after reveal
// ---------------------------------------------------------------------------

test("FlashcardCard Not yet calls onRate immediately after reveal", () => {
  const onRate = jest.fn();
  render(<FlashcardCard item={flashcard} onRate={onRate} />);

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Not yet"));

  expect(onRate).toHaveBeenCalledWith("failed");
  expect(onRate).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Slice 4 — NoteCard "Got it" calls onRate("passed") immediately
// ---------------------------------------------------------------------------

test("NoteCard Got it calls onRate immediately", () => {
  const onRate = jest.fn();
  render(<NoteCard item={note} onRate={onRate} />);

  fireEvent.click(screen.getByText("Got it"));

  expect(onRate).toHaveBeenCalledWith("passed");
  expect(onRate).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Slice 5 — NoteCard "Not yet" calls onRate("failed") immediately
// ---------------------------------------------------------------------------

test("NoteCard Not yet calls onRate immediately", () => {
  const onRate = jest.fn();
  render(<NoteCard item={note} onRate={onRate} />);

  fireEvent.click(screen.getByText("Not yet"));

  expect(onRate).toHaveBeenCalledWith("failed");
  expect(onRate).toHaveBeenCalledTimes(1);
});
