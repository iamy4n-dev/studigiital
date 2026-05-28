/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DrillView } from "../src/app/review/page";

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
