import { countByType, thisWeekCount } from "../src/lib/artifactStats";

const make = (type: string, daysAgo: number) => ({
  id: Math.random().toString(),
  capture_id: "c1",
  artifact_type: type,
  content: {},
  created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  source_text: "",
});

test("countByType returns zero for missing types", () => {
  const result = countByType([make("generate_flashcard", 0)]);
  expect(result.generate_flashcard).toBe(1);
  expect(result.generate_note).toBe(0);
  expect(result.generate_quiz).toBe(0);
});

test("countByType counts each type independently", () => {
  const artifacts = [
    make("generate_flashcard", 0),
    make("generate_flashcard", 1),
    make("generate_note", 0),
  ];
  const result = countByType(artifacts);
  expect(result.generate_flashcard).toBe(2);
  expect(result.generate_note).toBe(1);
  expect(result.generate_quiz).toBe(0);
});

test("thisWeekCount counts artifacts created in the last 7 days", () => {
  const artifacts = [
    make("generate_flashcard", 0),   // today — in
    make("generate_note", 6),         // 6 days ago — in
    make("generate_quiz", 7),         // exactly 7 days — out
    make("generate_quiz", 30),        // older — out
  ];
  expect(thisWeekCount(artifacts)).toBe(2);
});

test("thisWeekCount returns 0 for empty list", () => {
  expect(thisWeekCount([])).toBe(0);
});
