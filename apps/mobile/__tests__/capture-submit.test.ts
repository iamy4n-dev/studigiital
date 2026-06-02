jest.mock("expo-sqlite");
jest.mock("expo-task-manager");
jest.mock("expo-background-fetch");

import * as SQLiteMock from "expo-sqlite";
import { initQueue } from "../src/capture-queue";
import { submitCapture } from "../src/capture-submit";

const resetQueue = () => (SQLiteMock as unknown as { __reset: () => void }).__reset();

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(async () => {
  resetQueue();
  await initQueue();
  mockFetch.mockReset();
  process.env.EXPO_PUBLIC_API_URL = "http://api.test";
});

import { getByStatus } from "../src/capture-queue";

test("online + 200 → success with transform result", async () => {
  const result = { skill_name: "generate_flashcard", cards: [{ front: "Q", back: "A" }], source_summary: "s" };
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => result });

  const out = await submitCapture("my note", "quick_text", "free", true, null);

  expect(out).toEqual({ status: "success", result });
  expect(mockFetch).toHaveBeenCalledWith(
    "http://api.test/api/v1/captures/transform",
    expect.objectContaining({ method: "POST" })
  );
});

test("sends Authorization header when token provided", async () => {
  const result = { skill_name: "generate_flashcard", cards: [], source_summary: "" };
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => result });

  await submitCapture("my note", "quick_text", "free", true, "tok123");

  const headers = mockFetch.mock.calls[0][1].headers;
  expect(headers["Authorization"]).toBe("Bearer tok123");
});

test("offline → queued status and item stored as pending", async () => {
  const out = await submitCapture("my note", "quick_text", "free", false, null);

  expect(out).toEqual({ status: "queued" });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(await getByStatus("pending")).toHaveLength(1);
});

test("confirmed tags are included in the transform request body", async () => {
  const result = { skill_name: "generate_flashcard", cards: [{ front: "Q", back: "A" }], source_summary: "s" };
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => result });

  await submitCapture("my note", "quick_text", "free", true, null, ["math", "algebra"]);

  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.confirmed_tags).toEqual(["math", "algebra"]);
});

test("online + 500 → error status, fetch not retried", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

  const out = await submitCapture("my note", "quick_text", "free", true, null);

  expect(out).toMatchObject({ status: "error" });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
