/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ProfilePage } from "../src/components/ProfilePage";

jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: async () => null }),
  UserButton: () => null,
}));

jest.mock("next/link", () => {
  const Link = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children);
  Link.displayName = "Link";
  return Link;
});

const noToken = async () => null;

function mockMasteryFetch(data: object) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

const emptyMastery = {
  tags: [],
  activity: { mistakes_resolved_this_week: 0, tags_improved_this_week: 0 },
  streak_days: 0,
  xp: 0,
};

// ---------------------------------------------------------------------------
// Slice 1 — page renders Profile heading
// ---------------------------------------------------------------------------

test("renders Profile heading", async () => {
  mockMasteryFetch(emptyMastery);

  render(<ProfilePage getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 2 — tag grid shows name and percentage
// ---------------------------------------------------------------------------

test("tag grid shows tag name and mastery percentage", async () => {
  mockMasteryFetch({
    ...emptyMastery,
    tags: [
      { tag: "biology", item_count: 4, passed_count: 2, mastery_pct: 50, above_threshold: false },
    ],
  });

  render(<ProfilePage getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByText("biology")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 3 — tags at or above 80% show Mastered label
// ---------------------------------------------------------------------------

test("tags above threshold show Mastered label", async () => {
  mockMasteryFetch({
    ...emptyMastery,
    tags: [
      { tag: "chemistry", item_count: 5, passed_count: 5, mastery_pct: 100, above_threshold: true },
      { tag: "math", item_count: 4, passed_count: 2, mastery_pct: 50, above_threshold: false },
    ],
  });

  render(<ProfilePage getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByText("Mastered")).toBeInTheDocument();
    expect(screen.queryAllByText("Mastered")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Slice 4 — activity summary renders
// ---------------------------------------------------------------------------

test("activity summary renders mistakes resolved and tags improved", async () => {
  mockMasteryFetch({
    ...emptyMastery,
    activity: { mistakes_resolved_this_week: 12, tags_improved_this_week: 3 },
  });

  render(<ProfilePage getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByText(/12 mistakes resolved/)).toBeInTheDocument();
    expect(screen.getByText(/3 tags improved/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 5 — streak and XP visible
// ---------------------------------------------------------------------------

test("streak days and XP are visible", async () => {
  mockMasteryFetch({ ...emptyMastery, streak_days: 7, xp: 42 });

  render(<ProfilePage getToken={noToken} />);

  await waitFor(() => {
    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 6 — mistakes resolved tooltip
// ---------------------------------------------------------------------------

test("mistakes resolved has hint icon with tooltip text", async () => {
  mockMasteryFetch({
    ...emptyMastery,
    activity: { mistakes_resolved_this_week: 3, tags_improved_this_week: 0 },
  });

  render(<ProfilePage getToken={noToken} />);

  await waitFor(() => {
    const hint = screen.getByTitle(/Items you had trouble with/);
    expect(hint).toBeInTheDocument();
  });
});
