export const SKILL_NAMES = ["generate_flashcard", "generate_note", "generate_quiz"] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export const SKILL_LABELS: Record<SkillName, string> = {
  generate_flashcard: "Flashcards",
  generate_note: "Note",
  generate_quiz: "Quiz",
};

export function otherSkills(current: SkillName): [SkillName, SkillName] {
  return SKILL_NAMES.filter((s) => s !== current) as [SkillName, SkillName];
}
