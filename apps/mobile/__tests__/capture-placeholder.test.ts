import { getPlaceholder } from "../src/capture-placeholder";

test("each learning_type returns a non-empty distinct string", () => {
  const types = ["language_learner", "professional", "student", "generic"] as const;
  const results = types.map((t) => getPlaceholder(t));

  for (const r of results) {
    expect(typeof r).toBe("string");
    expect(r.length).toBeGreaterThan(0);
  }
  expect(new Set(results).size).toBe(4);
});

test("null learning_type returns generic fallback", () => {
  const fallback = getPlaceholder(null);
  expect(fallback).toBe(getPlaceholder("generic"));
});
