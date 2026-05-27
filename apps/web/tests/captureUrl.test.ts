import { buildCaptureUrl } from "../src/lib/captureUrl";

test("text and skill produces url with both params", () => {
  const url = buildCaptureUrl("hello world", "generate_note");
  const parsed = new URL(url, "http://x");
  expect(parsed.pathname).toBe("/capture");
  expect(parsed.searchParams.get("text")).toBe("hello world");
  expect(parsed.searchParams.get("skill")).toBe("generate_note");
});

test("text only — no skill param", () => {
  const url = buildCaptureUrl("hello world");
  const parsed = new URL(url, "http://x");
  expect(parsed.searchParams.get("skill")).toBeNull();
  expect(parsed.searchParams.get("text")).toBe("hello world");
});

test("special characters are encoded correctly", () => {
  const url = buildCaptureUrl("a & b = c");
  const parsed = new URL(url, "http://x");
  expect(parsed.searchParams.get("text")).toBe("a & b = c");
});
