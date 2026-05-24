jest.mock("expo-sqlite");
jest.mock("expo-task-manager");
jest.mock("expo-background-fetch");

import * as SQLiteMock from "expo-sqlite";
import { enqueue, initQueue } from "../src/capture-queue";
import { drainQueue } from "../src/capture-sync";

const resetQueue = () => (SQLiteMock as unknown as { __reset: () => void }).__reset();

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(async () => {
  resetQueue();
  await initQueue();
  mockFetch.mockReset();
  process.env.EXPO_PUBLIC_API_URL = "http://api.test";
});

test("empty queue — fetch never called", async () => {
  await drainQueue("free");
  expect(mockFetch).not.toHaveBeenCalled();
});

test("pending item + 200 response → marked synced", async () => {
  const id = await enqueue("study note", "quick_text");
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ skill_name: "generate_flashcard", cards: [], source_summary: "" }),
  });

  await drainQueue("paid");

  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith(
    "http://api.test/api/v1/captures/transform",
    expect.objectContaining({ method: "POST" })
  );

  const { getByStatus } = await import("../src/capture-queue");
  expect(await getByStatus("synced")).toHaveLength(1);
  expect(await getByStatus("pending")).toHaveLength(0);
});

test("pending item + HTTP 500 → marked failed", async () => {
  await enqueue("study note", "quick_text");
  mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

  await drainQueue("free");

  const { getByStatus } = await import("../src/capture-queue");
  expect(await getByStatus("failed")).toHaveLength(1);
  expect(await getByStatus("pending")).toHaveLength(0);
});

test("failed items are not retried", async () => {
  const { updateStatus } = await import("../src/capture-queue");
  const id = await enqueue("old failure", "quick_text");
  await updateStatus(id, "failed");

  await drainQueue("free");

  expect(mockFetch).not.toHaveBeenCalled();
});
