jest.mock("expo-sqlite");
jest.mock("expo-task-manager");
jest.mock("expo-background-fetch");

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.EXPO_PUBLIC_API_URL = "http://api.test";
});

import { fetchTagSuggestions } from "../src/tag-suggestions";

test("returns suggestions array from API on success", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ suggestions: ["biology", "photosynthesis"] }),
  });

  const result = await fetchTagSuggestions("Plants make food from sunlight.");

  expect(result).toEqual(["biology", "photosynthesis"]);
  expect(mockFetch).toHaveBeenCalledWith(
    "http://api.test/api/v1/captures/suggest-tags",
    expect.objectContaining({ method: "POST" })
  );
});

test("sends existing tags in request body", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ suggestions: ["biology"] }),
  });

  await fetchTagSuggestions("Some content", ["math", "chemistry"]);

  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.existing_tags).toEqual(["math", "chemistry"]);
});

test("returns empty array when offline or fetch fails", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));

  const result = await fetchTagSuggestions("Some content");

  expect(result).toEqual([]);
});

test("returns empty array when API returns non-ok status", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

  const result = await fetchTagSuggestions("Some content");

  expect(result).toEqual([]);
});

test("sends Authorization header when token provided", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ suggestions: ["math"] }),
  });

  await fetchTagSuggestions("Some content", [], "my-token");

  const headers = mockFetch.mock.calls[0][1].headers;
  expect(headers["Authorization"]).toBe("Bearer my-token");
});
