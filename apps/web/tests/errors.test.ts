import { mapErrorMessage } from "../src/lib/errors";

test("422 returns validation message", () => {
  expect(mapErrorMessage(422)).toBe(
    "Your text was too short or invalid — try adding more detail.",
  );
});

test("500 returns server error message", () => {
  expect(mapErrorMessage(500)).toBe(
    "Something went wrong on our end. Try again in a moment.",
  );
});

test("503 returns server error message", () => {
  expect(mapErrorMessage(503)).toBe(
    "Something went wrong on our end. Try again in a moment.",
  );
});

test("0 (network failure) returns generic fallback", () => {
  expect(mapErrorMessage(0)).toBe("Something went wrong. Try again.");
});
