/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ArtifactList } from "../src/app/artifacts/page";

jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: async () => null }),
}));

jest.mock("next/link", () => {
  const Link = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children);
  Link.displayName = "Link";
  return Link;
});

const noToken = async () => null;

const makeArtifact = (id: string, status: string, type = "generate_flashcard") => ({
  id,
  capture_id: "c1",
  artifact_type: type,
  content: { cards: [{ front: "Q", back: "A" }] },
  created_at: new Date().toISOString(),
  source_text: "some text",
  tags: [],
  status,
});

function mockFetch(artifacts: object[], suggestions: string[] = []) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("suggest-tags")) {
      return Promise.resolve({ ok: true, json: async () => ({ suggestions }) } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => artifacts } as Response);
  });
}

// ---------------------------------------------------------------------------
// Slice 3 — drafts section appears before tagged section
// ---------------------------------------------------------------------------

test("renders Needs tagging section heading when drafts are present", async () => {
  mockFetch([makeArtifact("draft-1", "draft"), makeArtifact("tagged-1", "tagged")]);

  render(<ArtifactList getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByText("Needs tagging")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 4 — draft card shows "Tag me" badge
// ---------------------------------------------------------------------------

test("draft card shows Tag me badge", async () => {
  mockFetch([makeArtifact("draft-1", "draft")]);

  render(<ArtifactList getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByText("Tag me")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 5 — clicking Tag me expands inline tag confirmation
// ---------------------------------------------------------------------------

test("clicking Tag me reveals tag input and confirm button", async () => {
  mockFetch([makeArtifact("draft-1", "draft")]);

  render(<ArtifactList getToken={noToken} />);

  await waitFor(() => screen.getByText("Tag me"));
  fireEvent.click(screen.getByText("Tag me"));

  await waitFor(() => {
    expect(screen.getByPlaceholderText(/add tags/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save tags/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 7 — no suggestion fetch when artifact already has committed tags
// ---------------------------------------------------------------------------

test("clicking Tag me on already-tagged draft does not fetch suggestions", async () => {
  const artifact = { ...makeArtifact("draft-tagged", "draft"), tags: ["existing"] };
  mockFetch([artifact], ["should-not-appear"]);

  render(<ArtifactList getToken={noToken} />);

  await waitFor(() => screen.getByText("Tag me"));
  fireEvent.click(screen.getByText("Tag me"));

  const input = screen.getByPlaceholderText(/add tags/i);
  // Give async fetch a chance to run (it shouldn't)
  await new Promise((r) => setTimeout(r, 50));
  expect(input).toHaveValue("");
  const calls = (global.fetch as jest.Mock).mock.calls as [string][];
  const suggestCalls = calls.filter(([url]) => url.includes("suggest-tags"));
  expect(suggestCalls).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Slice 6 — clicking Tag me on tagless draft pre-populates suggestions
// ---------------------------------------------------------------------------

test("clicking Tag me on tagless draft pre-populates input with suggestions", async () => {
  mockFetch([makeArtifact("draft-1", "draft")], ["biology", "photosynthesis"]);

  render(<ArtifactList getToken={noToken} />);

  await waitFor(() => screen.getByText("Tag me"));
  fireEvent.click(screen.getByText("Tag me"));

  await waitFor(() => {
    expect(screen.getByPlaceholderText(/add tags/i)).toHaveValue("biology, photosynthesis");
  });
});
