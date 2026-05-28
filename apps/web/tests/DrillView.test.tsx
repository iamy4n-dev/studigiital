/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { DrillView } from "../src/components/DrillView";

jest.mock("@clerk/nextjs", () => ({
  UserButton: () => null,
  useAuth: () => ({ getToken: async () => null }),
}));

jest.mock("next/link", () => {
  const Link = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children);
  Link.displayName = "Link";
  return Link;
});

jest.mock("@/lib/MarkdownContent", () => ({
  MarkdownContent: ({ children }: { children: string }) => <div>{children}</div>,
}));

const getToken = async () => null;
const onExit = jest.fn();
const config = { tags: ["biology"], mode: "structured" as const };

const flashcardItem = {
  id: "item-1",
  artifact_id: "a-1",
  item_type: "flashcard",
  content: { front: "What is ATP?", back: "Energy currency of the cell" },
  tags: ["biology"],
  source_text: "",
};

function mockFetch(items: object[], xpGained = 0) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes("/review/events")) {
      return Promise.resolve({ ok: true, json: async () => ({ id: "e1", xp_gained: xpGained }) } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ items, new_count: items.length, reviewed_count: 0 }),
    } as Response);
  });
}

// ---------------------------------------------------------------------------
// Slice 2 — toast appears immediately after rating (before backend responds)
// ---------------------------------------------------------------------------

test("toast appears immediately when Got it is clicked", async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes("/review/events")) {
      return new Promise(() => {}); // never resolves — xp stays null → "Good job!"
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ items: [flashcardItem], new_count: 1, reviewed_count: 0 }),
    } as Response);
  });

  render(<DrillView getToken={getToken} config={config} onExit={onExit} />);
  await waitFor(() => screen.getByText("What is ATP?"));

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Got it"));

  expect(screen.getByText(/Good job/i)).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 3 — toast for failed outcome shows "Keep going" message
// ---------------------------------------------------------------------------

test("toast shows keep going message after Not yet", async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes("/review/events")) {
      return new Promise(() => {});
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ items: [flashcardItem], new_count: 1, reviewed_count: 0 }),
    } as Response);
  });

  render(<DrillView getToken={getToken} config={config} onExit={onExit} />);
  await waitFor(() => screen.getByText("What is ATP?"));

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Not yet"));

  expect(screen.getByText(/Keep going/i)).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 4 — toast clears when Next is clicked
// ---------------------------------------------------------------------------

test("toast is gone after clicking Next", async () => {
  mockFetch([flashcardItem], 3); // earn XP so message stays "Good job!" before and after backend
  render(<DrillView getToken={getToken} config={config} onExit={onExit} />);
  await waitFor(() => screen.getByText("What is ATP?"));

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Got it"));

  await waitFor(() => expect(screen.getByText(/Good job/i)).toBeInTheDocument());

  fireEvent.click(screen.getByText("Next →"));

  await waitFor(() => expect(screen.queryByText(/Good job/i)).not.toBeInTheDocument());
});

// ---------------------------------------------------------------------------
// Slice 1 — single failing item: card resets after Next is clicked
// ---------------------------------------------------------------------------

test("single-item queue: card resets to front after rating Not yet and clicking Next", async () => {
  mockFetch([flashcardItem]);
  render(<DrillView getToken={getToken} config={config} onExit={onExit} />);

  await waitFor(() => screen.getByText("What is ATP?"));

  fireEvent.click(screen.getByText("Reveal answer"));
  fireEvent.click(screen.getByText("Not yet"));
  fireEvent.click(screen.getByText("Next →"));

  await waitFor(() => {
    expect(screen.getByText("Reveal answer")).toBeInTheDocument();
  });
});
