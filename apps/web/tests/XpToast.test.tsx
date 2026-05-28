/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { XpToast } from "../src/components/XpToast";

// ---------------------------------------------------------------------------
// Slice 1 — passed + xp pending (null): shows "Good job!" immediately
// ---------------------------------------------------------------------------

test("passed with pending XP shows Good job immediately", () => {
  render(<XpToast outcome="passed" xp={null} onDone={() => {}} />);
  expect(screen.getByText(/Good job/i)).toBeInTheDocument();
  expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 2 — passed + xp > 0: shows XP amount and encouragement
// ---------------------------------------------------------------------------

test("passed with earned XP shows amount and Good job", () => {
  render(<XpToast outcome="passed" xp={3} onDone={() => {}} />);
  expect(screen.getByText("+3 XP")).toBeInTheDocument();
  expect(screen.getByText(/Good job/i)).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 3 — passed + xp = 0: shows "Already mastered", no XP number
// ---------------------------------------------------------------------------

test("passed with zero XP shows already mastered message", () => {
  render(<XpToast outcome="passed" xp={0} onDone={() => {}} />);
  expect(screen.getByText(/Already mastered/i)).toBeInTheDocument();
  expect(screen.queryByText(/\+0 XP/)).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 4 — failed: shows "Keep going", no XP number
// ---------------------------------------------------------------------------

test("failed outcome shows keep going message", () => {
  render(<XpToast outcome="failed" xp={0} onDone={() => {}} />);
  expect(screen.getByText(/Keep going/i)).toBeInTheDocument();
  expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
});
