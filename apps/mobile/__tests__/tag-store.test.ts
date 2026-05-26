jest.mock("expo-sqlite");
jest.mock("expo-task-manager");
jest.mock("expo-background-fetch");

import * as SQLiteMock from "expo-sqlite";
import { getOrCreateTagColor, getAllTags, initTagStore } from "../src/tag-store";

const resetDB = () => (SQLiteMock as unknown as { __reset: () => void }).__reset();

beforeEach(async () => {
  resetDB();
  await initTagStore();
});

test("new tag gets a color assigned", async () => {
  const color = await getOrCreateTagColor("biology");
  expect(color).toMatch(/^#[0-9a-f]{6}$/i);
});

test("same tag name always returns the same color", async () => {
  const first = await getOrCreateTagColor("math");
  const second = await getOrCreateTagColor("math");
  expect(first).toBe(second);
});

test("all saved tags are retrievable", async () => {
  await getOrCreateTagColor("physics");
  await getOrCreateTagColor("chemistry");

  const tags = await getAllTags();
  const names = tags.map((t) => t.name);
  expect(names).toContain("physics");
  expect(names).toContain("chemistry");
});

test("different tags get different colors until palette exhausts", async () => {
  const names = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const colors = new Set<string>();
  for (const name of names) {
    colors.add(await getOrCreateTagColor(name));
  }
  expect(colors.size).toBe(names.length);
});
