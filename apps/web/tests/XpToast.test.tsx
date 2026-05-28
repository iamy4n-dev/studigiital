/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { XpToast } from "../src/components/XpToast";

// ---------------------------------------------------------------------------
// Slice 1 — badge renders with correct XP amount
// ---------------------------------------------------------------------------

test("renders xp amount when xp is positive", () => {
  render(<XpToast xp={3} onDone={() => {}} />);
  expect(screen.getByText("+3 XP")).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Slice 2 — calls onDone after 1500ms
// ---------------------------------------------------------------------------

test("calls onDone after 1500ms", () => {
  jest.useFakeTimers();
  const onDone = jest.fn();
  render(<XpToast xp={1} onDone={onDone} />);

  expect(onDone).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1500));
  expect(onDone).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
});
