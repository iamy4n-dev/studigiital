jest.mock("expo-sqlite");

import * as SQLiteMock from "expo-sqlite";
import { enqueue, getByStatus, initQueue, updateStatus } from "../src/capture-queue";

const resetQueue = () => (SQLiteMock as unknown as { __reset: () => void }).__reset();

beforeEach(async () => {
  resetQueue();
  await initQueue();
});

test("enqueue adds item retrievable as pending", async () => {
  const id = await enqueue("hello world", "quick_text");
  const pending = await getByStatus("pending");
  expect(pending).toHaveLength(1);
  expect(pending[0]!).toMatchObject({ id, text: "hello world", mode: "quick_text", status: "pending" });
});

test("updateStatus moves item out of pending", async () => {
  const id = await enqueue("test", "quick_text");
  await updateStatus(id, "synced");
  expect(await getByStatus("pending")).toHaveLength(0);
  expect(await getByStatus("synced")).toHaveLength(1);
});

test("updateStatus stores result_json", async () => {
  const id = await enqueue("test", "quick_text");
  await updateStatus(id, "synced", '{"cards":[]}');
  const synced = await getByStatus("synced");
  expect(synced[0]!.result_json).toBe('{"cards":[]}');
});

test("initQueue is idempotent", async () => {
  await enqueue("a", "quick_text");
  await initQueue(); // second call must not wipe existing rows
  expect(await getByStatus("pending")).toHaveLength(1);
});
