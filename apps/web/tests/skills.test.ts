import { otherSkills } from "../src/lib/skills";

test("flashcard → note + quiz", () => {
  expect(otherSkills("generate_flashcard")).toEqual(["generate_note", "generate_quiz"]);
});

test("note → flashcard + quiz", () => {
  expect(otherSkills("generate_note")).toEqual(["generate_flashcard", "generate_quiz"]);
});

test("quiz → flashcard + note", () => {
  expect(otherSkills("generate_quiz")).toEqual(["generate_flashcard", "generate_note"]);
});
