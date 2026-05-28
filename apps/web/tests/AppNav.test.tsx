/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { AppNav } from "../src/components/AppNav";

jest.mock("@clerk/nextjs", () => ({
  UserButton: () => <span data-testid="user-button" />,
}));

jest.mock("next/link", () => {
  const Link = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children);
  Link.displayName = "Link";
  return Link;
});

// ---------------------------------------------------------------------------
// Slice 1 — all five nav items render
// ---------------------------------------------------------------------------

test("renders all five nav items", () => {
  render(<AppNav active="dashboard" />);
  ["Home", "Capture", "Review", "History", "Profile"].forEach((label) => {
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Slice 2 — active page is a span, others are links
// ---------------------------------------------------------------------------

test("active page renders as span not link", () => {
  render(<AppNav active="review" />);
  expect(screen.getByText("Review").tagName).toBe("SPAN");
  expect(screen.getByText("Home").tagName).toBe("A");
  expect(screen.getByText("Profile").tagName).toBe("A");
});

// ---------------------------------------------------------------------------
// Slice 3 — UserButton is always rendered in the header
// ---------------------------------------------------------------------------

test("UserButton is rendered in the header", () => {
  render(<AppNav active="dashboard" />);
  expect(screen.getByTestId("user-button")).toBeInTheDocument();
});
