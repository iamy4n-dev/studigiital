/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import { TagConfirm } from "../src/lib/TagConfirm";

jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: async () => null }),
  UserButton: () => null,
}));

// ---------------------------------------------------------------------------
// Slice 1 — fetches existing tags with Authorization header when token provided
// (Regression: GET /api/v1/tags/ was losing auth via 308→307 redirect chain)
// ---------------------------------------------------------------------------

test("fetches /api/v1/tags/ with Authorization header when token provided", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);

  render(
    <TagConfirm
      suggestions={[]}
      artifactId="art-1"
      getToken={async () => "tok-xyz"}
    />
  );

  await waitFor(() => {
    const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit][];
    const tagsCall = calls.find(([url]) => url.includes("/api/v1/tags"));
    expect(tagsCall).toBeDefined();
    expect(tagsCall![1].headers).toMatchObject({
      Authorization: "Bearer tok-xyz",
    });
  });
});

// ---------------------------------------------------------------------------
// Slice 2 — skips Authorization header when no token
// ---------------------------------------------------------------------------

test("fetches /api/v1/tags/ without Authorization header when token is null", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);

  render(
    <TagConfirm
      suggestions={[]}
      artifactId="art-1"
      getToken={async () => null}
    />
  );

  await waitFor(() => {
    const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit][];
    const tagsCall = calls.find(([url]) => url.includes("/api/v1/tags"));
    expect(tagsCall).toBeDefined();
    expect((tagsCall![1].headers as Record<string, string>)?.Authorization).toBeUndefined();
  });
});
