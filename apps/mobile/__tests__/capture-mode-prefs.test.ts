jest.mock("expo-sqlite");

import * as SQLiteMock from "expo-sqlite";
import { getLastMode, initModePrefs, setLastMode } from "../src/capture-mode-prefs";

const resetQueue = () => (SQLiteMock as unknown as { __reset: () => void }).__reset();

beforeEach(async () => {
  resetQueue();
  await initModePrefs();
});

test("setLastMode then getLastMode returns the same mode", async () => {
  await setLastMode("photo");
  expect(await getLastMode()).toBe("photo");
});

test("no mode set → defaults to quick_text", async () => {
  expect(await getLastMode()).toBe("quick_text");
});
